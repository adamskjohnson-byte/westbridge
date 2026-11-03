<?php

namespace App\Http\Controllers\Api\V1\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\ForgotPasswordRequest;
use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Password;

class ForgotPasswordController extends Controller
{
    public function __invoke(ForgotPasswordRequest $request): JsonResponse
    {
        $email = $request->validated('email');
        $user = User::query()->where('email', $email)->first();

        // Keep the response identical for known and unknown addresses to prevent account enumeration.
        Password::sendResetLink(['email' => $email]);

        AuditLog::create([
            'user_id' => $user?->getKey(),
            'action' => 'auth.password_reset_requested',
            'entity_type' => 'user',
            'entity_id' => $user === null ? null : (string) $user->getKey(),
            'ip_address' => $request->ip(),
            'user_agent' => mb_substr((string) $request->userAgent(), 0, 255),
            'metadata' => ['email_sha256' => hash('sha256', $email)],
            'created_at' => now(),
        ]);

        return response()->json([
            'code' => 'reset_link_sent_if_exists',
            'message' => 'If that email exists, a reset link is on its way.',
        ]);
    }
}
