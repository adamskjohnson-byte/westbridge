<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;

class DevLinks extends Command
{
    protected $signature = 'dev:links';

    protected $description = 'Print the newest local verification and password reset links';

    public function handle(): int
    {
        if (! app()->environment('local')) {
            $this->error('This command is available only when APP_ENV=local.');

            return self::FAILURE;
        }

        $logPath = storage_path('logs/laravel.log');
        if (! is_file($logPath) || ! is_readable($logPath)) {
            $this->error('The Laravel log file is not available.');

            return self::FAILURE;
        }

        $contents = file_get_contents($logPath);
        if ($contents === false) {
            $this->error('The Laravel log file could not be read.');

            return self::FAILURE;
        }

        $records = preg_split('/(?=^\[\d{4}-\d{2}-\d{2}[ T][^\]]+\]\s)/m', $contents, -1, PREG_SPLIT_NO_EMPTY) ?: [];
        $latest = ['verification' => null, 'reset' => null];

        foreach ($records as $record) {
            preg_match('/^To:\s*(.+)$/mi', $record, $recipientMatch);
            preg_match('/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i', $recipientMatch[1] ?? '', $emailMatch);
            $email = $emailMatch[0] ?? null;
            if ($email === null) {
                continue;
            }

            preg_match_all('/https?:\/\/[^\s"\'<>]+/i', html_entity_decode($record, ENT_QUOTES | ENT_HTML5), $urlMatches);
            foreach ($urlMatches[0] ?? [] as $url) {
                $url = rtrim($url, '.,);]');
                $type = match (true) {
                    str_contains($url, '/verify-email?') => 'verification',
                    str_contains($url, '/reset-password?') => 'reset',
                    default => null,
                };
                if ($type !== null) {
                    $latest[$type] = ['email' => $email, 'url' => $url];
                }
            }
        }

        foreach ($latest as $type => $link) {
            if ($link === null) {
                $this->line(ucfirst($type).': no link found.');
                continue;
            }

            $this->line(ucfirst($type).' for '.$link['email'].': '.$link['url']);
        }

        return self::SUCCESS;
    }
}
