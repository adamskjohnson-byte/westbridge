<?php

namespace App\Http\Controllers\Api\V1\Auth;

use App\Exceptions\Auth\InvalidVerificationLinkException;
use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\User;
use App\Notifications\WelcomeNotification;
use App\Support\ApiResponse;
use Illuminate\Auth\Events\Verified;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\URL;

class VerifyEmailController extends Controller
{
    public function __invoke(Request $request, string $id, string $hash): JsonResponse
    {
        // Validate the signed absolute API URL, including expiration, before changing verification state.
        if (! URL::hasValidSignature($request)) {
            $this->writeAudit(null, $request, 'auth.email_verification_failed');

            throw new InvalidVerificationLinkException;
        }

        $user = User::query()->find($id);
        if ($user === null || ! hash_equals(sha1($user->getEmailForVerification()), $hash)) {
            $this->writeAudit($user, $request, 'auth.email_verification_failed');

            throw new InvalidVerificationLinkException;
        }

        if ($user->hasVerifiedEmail()) {
            $this->writeAudit($user, $request, 'auth.email_verification_already_verified');

            return ApiResponse::success(null, 'Email already verified.');
        }

        $user->markEmailAsVerified();
        event(new Verified($user));

        $this->writeAudit($user, $request, 'auth.email_verified');

        Notification::send($user, new WelcomeNotification);

        return ApiResponse::success(null, 'Email verified.');
    }

    private function writeAudit(?User $user, Request $request, string $action): void
    {
        AuditLog::create([
            'user_id' => $user?->getKey(),
            'action' => $action,
            'entity_type' => 'user',
            'entity_id' => $user === null ? null : (string) $user->getKey(),
            'ip_address' => $request->ip(),
            'user_agent' => mb_substr((string) $request->userAgent(), 0, 255),
            'created_at' => now(),
        ]);
    }
}
