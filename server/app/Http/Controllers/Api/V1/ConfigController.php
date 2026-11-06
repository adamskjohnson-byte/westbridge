<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;

class ConfigController extends Controller
{
    public function __invoke(): JsonResponse
    {
        return response()->json([
            'email_verification_required' => (bool) config('bank.auth.require_email_verification', true),
            'turnstile' => [
                'enabled' => (bool) config('security.turnstile.enabled', true),
                'sitekey' => (string) config('security.turnstile.sitekey', ''),
            ],
            'two_factor_admin_required' => (bool) config('security.two_factor.admin_required', true),
        ]);
    }
}
