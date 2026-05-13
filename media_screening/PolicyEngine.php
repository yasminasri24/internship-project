<?php

/**
 * PolicyEngine
 * -------------
 * Central decision engine for media moderation.
 * Applies priority-based rules, thresholds, severity,
 * and recommended actions.
 *
 * Order of enforcement (highest priority first):
 * 1. Sensitive documents (passport / IC / confidential)
 * 2. Sexual / Pornographic content
 * 3. Extreme violence / gore
 * 4. Weapons / dangerous items
 * 5. Illegal drugs
 * 6. Hate symbols
 */

class PolicyEngine {

    public function evaluate(array $scores): array
    {
        // 1️⃣ Sensitive documents – ALWAYS BLOCK
        if ($this->isViolated($scores, "sensitive_doc", 0.85)) {
            return $this->decision("sensitive_doc", "high", "block");
        }

        // 2️⃣ Sexual content
        if ($this->isViolated($scores, "sexual_content", 0.85)) {
            return $this->decision("sexual_content", "high", "block");
        }

        // 3️⃣ Violence
        if ($this->isViolated($scores, "violence", 0.70)) {
            return $this->decision(
                "violence",
                $scores["violence"] > 0.85 ? "high" : "medium",
                $scores["violence"] > 0.85 ? "block" : "blur"
            );
        }

        // 4️⃣ Weapons
        if ($this->isViolated($scores, "weapons", 0.70)) {
            return $this->decision("weapons", "medium", "blur");
        }

        // 5️⃣ Drugs
        if ($this->isViolated($scores, "drugs", 0.70)) {
            return $this->decision("drugs", "medium", "blur");
        }

        // 6️⃣ Hate symbols
        if ($this->isViolated($scores, "hate_symbols", 0.85)) {
            return $this->decision("hate_symbols", "high", "block");
        }

        // ✅ SAFE CONTENT
        return [
            "is_flagged" => false,
            "action"     => "allow"
        ];
    }

    private function isViolated(array $scores, string $key, float $threshold): bool
    {
        return isset($scores[$key]) && $scores[$key] >= $threshold;
    }

    private function decision(string $category, string $severity, string $action): array
    {
        return [
            "category"   => $category,
            "severity"   => $severity,
            "action"     => $action,
            "is_flagged" => true
        ];
    }
}
