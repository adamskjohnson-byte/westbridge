<?php

namespace App\Http\Controllers\Api\V1\Auth;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ResendVerificationController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $user = $request->user();

        if (! config('bank.auth.require_email_verification', true) || $user->hasVerifiedEmail()) {
            $this->writeAudit($user, $request, 'auth.verification_resend_skipped');

            return ApiResponse::success(null, 'Already verified.');
        }

        $user->sendEmailVerificationNotification();
        $this->writeAudit($user, $request, 'auth.verification_resent');

        return ApiResponse::success(null, 'Verification link sent.');
    }

    private function writeAudit(object $user, Request $request, string $action): void
    {
        AuditLog::create([
            'user_id' => $user->getKey(),
            'action' => $action,
            'entity_type' => 'user',
            'entity_id' => (string) $user->getKey(),
            'ip_address' => $request->ip(),
            'user_agent' => mb_substr((string) $request->userAgent(), 0, 255),
            'created_at' => now(),
        ]);
    }
}
