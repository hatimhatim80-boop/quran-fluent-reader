package app.lovable.p9444b7b6261c4f408a4fa03f717ae338;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        // Native Android speech recognition used by the recitation session.
        registerPlugin(NoorSpeechPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
