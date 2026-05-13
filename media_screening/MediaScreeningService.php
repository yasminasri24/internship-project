<?php

require_once __DIR__ . "/PolicyEngine.php";
require_once __DIR__ . "/Logger.php";
require_once __DIR__ . "/Providers/MockVisionProvider.php";


class MediaScreeningService {

    public function screen($file) {
        // Step 1: AI analysis
        $provider = new MockVisionProvider();
        $scores = $provider->scan($file);

        // Step 2: Policy decision
        $policy = new PolicyEngine();
        $decision = $policy->evaluate($scores);

        // Step 3: Audit log
        Logger::log([
            "file" => $file['name'],
            "scores" => $scores,
            "decision" => $decision,
            "timestamp" => date("c")
        ]);

        return array_merge($scores, $decision);
    }
}
