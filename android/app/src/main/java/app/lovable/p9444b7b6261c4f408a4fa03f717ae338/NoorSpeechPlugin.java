package app.lovable.p9444b7b6261c4f408a4fa03f717ae338;

import android.Manifest;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.util.ArrayList;
import java.util.List;

/**
 * Native Android speech recognition for Quran recitation.
 *
 * Mirrors the approach that works on-device in the reference app: the system
 * SpeechRecognizer is driven directly with live partial results, Arabic biasing
 * strings and a segmented (continuous) session, and it is relaunched in place
 * whenever Android closes the session on silence.
 */
@CapacitorPlugin(
    name = "NoorSpeech",
    permissions = {
        @Permission(strings = { Manifest.permission.RECORD_AUDIO }, alias = NoorSpeechPlugin.MIC)
    }
)
public class NoorSpeechPlugin extends Plugin {

    static final String MIC = "microphone";
    private static final long RESTART_DELAY_MS = 250;

    private final Handler main = new Handler(Looper.getMainLooper());
    private SpeechRecognizer recognizer;
    private Intent intent;
    private boolean running = false;
    private boolean restarting = false;
    private String lastPartial = "";

    // ── public API ──────────────────────────────────────────────────────────

    @PluginMethod
    public void available(PluginCall call) {
        JSObject result = new JSObject();
        result.put("available", SpeechRecognizer.isRecognitionAvailable(getContext()));
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            result.put("onDeviceAvailable", SpeechRecognizer.isOnDeviceRecognitionAvailable(getContext()));
        }
        result.put("sdk", Build.VERSION.SDK_INT);
        call.resolve(result);
    }

    @PluginMethod
    public void checkMicPermission(PluginCall call) {
        JSObject result = new JSObject();
        result.put("microphone", getPermissionState(MIC).toString());
        call.resolve(result);
    }

    @PluginMethod
    public void requestMicPermission(PluginCall call) {
        if (getPermissionState(MIC) == com.getcapacitor.PermissionState.GRANTED) {
            checkMicPermission(call);
            return;
        }
        requestPermissionForAlias(MIC, call, "micPermissionResult");
    }

    @PermissionCallback
    private void micPermissionResult(PluginCall call) {
        checkMicPermission(call);
    }

    @PluginMethod
    public void start(final PluginCall call) {
        if (getPermissionState(MIC) != com.getcapacitor.PermissionState.GRANTED) {
            call.reject("INSUFFICIENT_PERMISSIONS");
            return;
        }
        if (!SpeechRecognizer.isRecognitionAvailable(getContext())) {
            call.reject("SERVICE_NOT_AVAILABLE");
            return;
        }

        final String language = call.getString("language", "ar-SA");
        final boolean preferOffline = Boolean.TRUE.equals(call.getBoolean("preferOffline", false));
        final List<String> biasing = new ArrayList<>();
        JSArray strings = call.getArray("contextualStrings", null);
        if (strings != null) {
            try {
                for (Object value : strings.toList()) {
                    if (value != null && !value.toString().trim().isEmpty()) biasing.add(value.toString());
                }
            } catch (Exception ignored) { }
        }

        lastPartial = "";
        running = true;

        main.post(() -> {
            try {
                releaseRecognizer();
                recognizer = SpeechRecognizer.createSpeechRecognizer(getContext());
                recognizer.setRecognitionListener(listener);
                intent = buildIntent(language, biasing, preferOffline);
                recognizer.startListening(intent);
                call.resolve();
            } catch (Exception error) {
                running = false;
                call.reject("CLIENT", error);
            }
        });
    }

    @PluginMethod
    public void stop(PluginCall call) {
        running = false;
        main.post(() -> {
            try { if (recognizer != null) recognizer.stopListening(); } catch (Exception ignored) { }
            call.resolve();
        });
    }

    @PluginMethod
    public void forceStop(PluginCall call) {
        running = false;
        main.post(() -> {
            releaseRecognizer();
            emitState("stopped");
            call.resolve();
        });
    }

    @PluginMethod
    public void getLastPartialResult(PluginCall call) {
        JSObject result = new JSObject();
        result.put("text", lastPartial);
        call.resolve(result);
    }

    // ── internals ───────────────────────────────────────────────────────────

    private Intent buildIntent(String language, List<String> biasing, boolean preferOffline) {
        Intent recognizeIntent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        recognizeIntent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        recognizeIntent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, language);
        recognizeIntent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, language);
        recognizeIntent.putExtra("android.speech.extra.EXTRA_ADDITIONAL_LANGUAGES", new String[] { language });
        recognizeIntent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
        recognizeIntent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 5);
        recognizeIntent.putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, getContext().getPackageName());
        recognizeIntent.putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, preferOffline);
        // Give the reciter room to breathe between ayahs before Android closes the turn.
        recognizeIntent.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 6000L);
        recognizeIntent.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, 6000L);
        recognizeIntent.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_MINIMUM_LENGTH_MILLIS, 20000L);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            // Continuous dictation: one session that keeps emitting segment results.
            recognizeIntent.putExtra(
                RecognizerIntent.EXTRA_SEGMENTED_SESSION,
                RecognizerIntent.EXTRA_SPEECH_INPUT_MINIMUM_LENGTH_MILLIS
            );
            if (!biasing.isEmpty()) {
                ArrayList<String> limited = new ArrayList<>(biasing.subList(0, Math.min(biasing.size(), 300)));
                recognizeIntent.putStringArrayListExtra(RecognizerIntent.EXTRA_BIASING_STRINGS, limited);
            }
        }
        return recognizeIntent;
    }

    private void releaseRecognizer() {
        if (recognizer == null) return;
        try { recognizer.cancel(); } catch (Exception ignored) { }
        try { recognizer.destroy(); } catch (Exception ignored) { }
        recognizer = null;
    }

    /** Android closed the turn but the reciter has not stopped: reopen in place. */
    private void scheduleRestart() {
        if (!running || restarting) return;
        restarting = true;
        main.postDelayed(() -> {
            restarting = false;
            if (!running) return;
            try {
                releaseRecognizer();
                recognizer = SpeechRecognizer.createSpeechRecognizer(getContext());
                recognizer.setRecognitionListener(listener);
                recognizer.startListening(intent);
            } catch (Exception error) {
                emitError("CLIENT", String.valueOf(error.getMessage()));
            }
        }, RESTART_DELAY_MS);
    }

    private void emitState(String state) {
        JSObject payload = new JSObject();
        payload.put("state", state);
        notifyListeners("listeningState", payload);
    }

    private void emitError(String code, String message) {
        JSObject payload = new JSObject();
        payload.put("code", code);
        payload.put("message", message);
        notifyListeners("error", payload);
    }

    private String best(Bundle results) {
        if (results == null) return "";
        ArrayList<String> matches = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
        if (matches == null || matches.isEmpty()) return "";
        String top = "";
        for (String value : matches) if (value != null && value.length() > top.length()) top = value;
        return top;
    }

    private static String errorName(int code) {
        switch (code) {
            case SpeechRecognizer.ERROR_NETWORK_TIMEOUT: return "NETWORK_TIMEOUT";
            case SpeechRecognizer.ERROR_NETWORK: return "NETWORK";
            case SpeechRecognizer.ERROR_AUDIO: return "AUDIO";
            case SpeechRecognizer.ERROR_SERVER: return "SERVER";
            case SpeechRecognizer.ERROR_CLIENT: return "CLIENT";
            case SpeechRecognizer.ERROR_SPEECH_TIMEOUT: return "SPEECH_TIMEOUT";
            case SpeechRecognizer.ERROR_NO_MATCH: return "NO_MATCH";
            case SpeechRecognizer.ERROR_RECOGNIZER_BUSY: return "RECOGNIZER_BUSY";
            case SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS: return "INSUFFICIENT_PERMISSIONS";
            case 11: return "LANGUAGE_NOT_SUPPORTED";
            case 12: return "LANGUAGE_UNAVAILABLE";
            case 13: return "SERVER_DISCONNECTED";
            case 14: return "TOO_MANY_REQUESTS";
            default: return String.valueOf(code);
        }
    }

    private final RecognitionListener listener = new RecognitionListener() {
        @Override public void onReadyForSpeech(Bundle params) { emitState("listening"); }
        @Override public void onBeginningOfSpeech() { emitState("listening"); }

        @Override public void onRmsChanged(float rmsdB) {
            JSObject payload = new JSObject();
            payload.put("level", rmsdB);
            notifyListeners("audioLevel", payload);
        }

        @Override public void onBufferReceived(byte[] buffer) { }
        @Override public void onEndOfSpeech() { }

        @Override public void onError(int code) {
            String name = errorName(code);
            boolean silence = "NO_MATCH".equals(name) || "SPEECH_TIMEOUT".equals(name);
            if (running && silence) { scheduleRestart(); return; }
            if (running && "CLIENT".equals(name)) { scheduleRestart(); return; }
            emitError(name, name);
            if (!running) emitState("stopped");
        }

        @Override public void onResults(Bundle results) {
            String text = best(results);
            if (!text.isEmpty()) {
                lastPartial = text;
                JSObject payload = new JSObject();
                payload.put("text", text);
                notifyListeners("segmentResults", payload);
            }
            if (running) scheduleRestart(); else emitState("stopped");
        }

        @Override public void onPartialResults(Bundle partialResults) {
            String text = best(partialResults);
            if (text.isEmpty()) return;
            lastPartial = text;
            JSObject payload = new JSObject();
            payload.put("text", text);
            notifyListeners("partialResults", payload);
        }

        @Override public void onSegmentResults(Bundle segmentResults) {
            String text = best(segmentResults);
            if (text.isEmpty()) return;
            lastPartial = text;
            JSObject payload = new JSObject();
            payload.put("text", text);
            notifyListeners("segmentResults", payload);
        }

        @Override public void onEndOfSegmentedSession() {
            if (running) scheduleRestart(); else emitState("stopped");
        }

        @Override public void onEvent(int eventType, Bundle params) { }
    };

    @Override
    protected void handleOnDestroy() {
        running = false;
        main.post(this::releaseRecognizer);
        super.handleOnDestroy();
    }
}
