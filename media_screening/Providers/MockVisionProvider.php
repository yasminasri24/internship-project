<?php

class MockVisionProvider {

    public function scan($file) {
        $name = $file['name'] ?? '';
        if(str_contains($name, "clean")) {
            // CLEAN → allow
            return [
                "sexual_content" => 0.01,
                "violence" => 0.01,
                "weapons" => 0.01,
                "drugs" => 0.01,
                "hate_symbols" => 0.01,
                "sensitive_doc" => 0.01
            ];
        }

        if(str_contains($name, "flagged")) {
            // FLAGGED → blur
            return [
                "sexual_content" => 0.01,
                "violence" => 0.5,   // medium violence → blur
                "weapons" => 0.01,
                "drugs" => 0.01,
                "hate_symbols" => 0.01,
                "sensitive_doc" => 0.01
            ];
        }

        if(str_contains($name, "blocked")) {
            // BLOCK → block
            return [
                "sexual_content" => 0.15, // exceed threshold → block
                "violence" => 0.01,
                "weapons" => 0.01,
                "drugs" => 0.01,
                "hate_symbols" => 0.01,
                "sensitive_doc" => 0.01
            ];
        }

        // Default safe
        return [
            "sexual_content" => 0.01,
            "violence" => 0.01,
            "weapons" => 0.01,
            "drugs" => 0.01,
            "hate_symbols" => 0.01,
            "sensitive_doc" => 0.01
        ];
    }
}

