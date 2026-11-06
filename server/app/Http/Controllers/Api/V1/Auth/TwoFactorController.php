<?php

namespace App\Http\Controllers\Api\V1\Auth;

use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use App\Services\TwoFactorService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;

class TwoFactorController extends Controller
{
    public function verify(Request $request, TwoFactorService $twoFactor): JsonResponse
    {
        $data = $request->validate([
            'challenge_id' => ['required', 'string', 'size:26'],
            'code' => ['required', 'digits:'.(int) config('security.two_factor.code_length', 6)],
        ], ['challenge_id.required' => 'validation.two_factor_expired', 'code.required' => 'validation.two_factor_code_invalid', 'code.digits' => 'validation.two_factor_code_invalid']);

        return response()->json(['data' => new UserResource($twoFactor->verifyLogin($data['challenge_id'], $data['code'], $request))]);
    }

    public function resend(Request $request, TwoFactorService $twoFactor): JsonResponse
    {
        $data = $request->validate(['challenge_id' => ['required', 'string', 'size:26']], ['challenge_id.required' => 'validation.two_factor_expired']);
        $result = $twoFactor->resend($data['challenge_id'], $request);
        if ($result['rate_limited']) {
            return response()->json([
                'code' => 'too_many_requests', 'message' => 'Too many requests.',
            ], 429, ['Retry-After' => (string) $result['retry_after']]);
        }
        return response()->json(['data' => ['resend_available_in' => $result['resend_available_in']]]);
    }
}