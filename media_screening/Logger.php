<?php

class Logger {

    public static function log($data) {
        file_put_contents(
            __DIR__ . "/media_audit.log",
            json_encode($data) . PHP_EOL,
            FILE_APPEND
        );
    }
}
