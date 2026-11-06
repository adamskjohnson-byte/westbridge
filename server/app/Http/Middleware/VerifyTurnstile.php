<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;

class VerifyTurnstile
{
    public function handle(Request $request, Closure $next): Response
    {
        if (! (bool) config('security.turnstile.enabled', true)) {
            return $next($request);
        }

        $token = (string) ($request->input('turnstile_token') ?: $request->header('X-Turnstile-Token', ''));
        if ($token === '') {
            return $this->failed();
        }

        try {
            $response = Http::asForm()->timeout((int) config('security.turnstile.timeout', 5))
                ->post('https://challenges.cloudflare.com/turnstile/v0/siteverify', [
                    'secret' => (string) config('security.turnstile.secret', ''),
                    'response' => $token,
                    'remoteip' => $request->ip(),
                ]);
            if (! $response->successful()) {
                Log::warning('Turnstile verification failed', ['error_codes' => ['siteverify_http_'.$response->status()]]);
                return $this->failed();
            }
            $result = $response->json();
            if (! is_array($result) || ($result['success'] ?? false) !== true) {
                $codes = is_array($result['error-codes'] ?? null) ? array_values(array_filter($result['error-codes'], 'is_string')) : [];
                Log::warning('Turnstile verification failed', ['error_codes' => $codes]);
                return $this->failed();
            }
            $expected = config('security.turnstile.expected_hostnames', []);
            if ($expected !== [] && ! in_array((string) ($result['hostname'] ?? ''), $expected, true)) {
                Log::warning('Turnstile verification failed', ['error_codes' => ['hostname_mismatch']]);
                return $this->failed();
            }
        } catch (ConnectionException) {
            Log::warning('Turnstile verification failed', ['error_codes' => ['siteverify_unavailable']]);
            return $this->failed();
        } catch (\Throwable) {
            Log::warning('Turnstile verification failed', ['error_codes' => ['siteverify_error']]);
            return $this->failed();
        }

        return $next($request);
    }

    private function failed(): Response
    {
        return response()->json([
            'code' => 'captcha_failed',
            'message' => 'Human verification failed. Please try again.',
            'errors' => ['turnstile_token' => ['validation.captcha_failed']],
        ], 422);
    }
}