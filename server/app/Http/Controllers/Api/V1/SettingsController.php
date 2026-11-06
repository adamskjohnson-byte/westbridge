<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\SettingsService;
use App\Services\TwoFactorService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Validation\Rules\Password;

class SettingsController extends Controller
{
    public function __construct(private readonly SettingsService $settings) {}
    public function show(Request $request): JsonResponse { return response()->json(['data' => $this->settings->get($request->user())]); }

    public function profile(Request $request): JsonResponse
    {
        $data = $request->validate([
            'first_name' => ['required', 'string', 'min:2', 'max:60'], 'last_name' => ['required', 'string', 'min:2', 'max:60'],
            'phone' => ['nullable', 'string', 'min:7', 'max:20', 'regex:/^[0-9 +()\-]+$/'],
        ], ['first_name.required' => 'validation.name_required', 'first_name.min' => 'validation.name_min', 'first_name.max' => 'validation.name_max', 'last_name.required' => 'validation.name_required', 'last_name.min' => 'validation.name_min', 'last_name.max' => 'validation.name_max', 'phone.regex' => 'validation.phone_invalid', 'phone.min' => 'validation.phone_invalid', 'phone.max' => 'validation.phone_invalid']);
        $user = $this->settings->profile($request->user(), $data, (string) $request->ip(), (string) $request->userAgent());

        return response()->json(['data' => ['first_name' => $user->first_name, 'last_name' => $user->last_name, 'email' => $user->email, 'phone' => $user->phone]]);
    }

    public function preferences(Request $request): JsonResponse
    {
        $data = $request->validate([
            'locale' => ['nullable', 'string', 'in:'.implode(',', config('bank.supported_locales'))],
            'theme' => ['sometimes', 'in:light,dark,system'], 'email_activity' => ['sometimes', 'boolean'],
            'low_balance_threshold_cents' => ['nullable', 'integer', 'min:0', 'max:100000000'],
        ], ['locale.in' => 'validation.locale_invalid', 'theme.in' => 'validation.theme_invalid', 'email_activity.boolean' => 'validation.email_activity_invalid', 'low_balance_threshold_cents.integer' => 'validation.threshold_invalid', 'low_balance_threshold_cents.min' => 'validation.threshold_invalid', 'low_balance_threshold_cents.max' => 'validation.threshold_invalid']);
        $settings = $this->settings->preferences($request->user(), $data);

        return response()->json(['data' => $settings->only(['locale', 'theme', 'email_activity', 'low_balance_threshold_cents'])]);
    }

    public function password(Request $request): JsonResponse
    {
        $key = 'settings-password:user:'.hash('sha256', (string) $request->user()->getKey());
        if (RateLimiter::tooManyAttempts($key, 5)) {
            abort(429);
        }
        RateLimiter::hit($key, 60);
        $attributes = $request->validate([
            'current_password' => ['required', 'string'], 'password' => ['required', 'string', 'min:10', 'regex:/[a-z]/', 'regex:/[A-Z]/', 'regex:/[0-9]/', 'confirmed'],
            'password_confirmation' => ['required', 'string'],
        ], ['current_password.required' => 'validation.current_password_invalid', 'password.min' => 'validation.password_min', 'password.regex' => 'validation.password_invalid', 'password.confirmed' => 'validation.password_confirmed', 'password_confirmation.required' => 'validation.password_confirmation_required']);
        $currentSession = $request->hasSession() ? $request->session()->getId() : '';
        $this->settings->changePassword($request->user(), $attributes, (string) $request->ip(), (string) $request->userAgent(), $currentSession);

        return response()->json(['data' => ['updated' => true]]);
    }

    public function twoFactorStart(Request $request, TwoFactorService $twoFactor): JsonResponse
    {
        $data = $request->validate([
            'purpose' => ['required', 'in:enable,disable'],
            'password' => ['required', 'string'],
        ], ['purpose.in' => 'validation.two_factor_purpose_invalid', 'password.required' => 'validation.password_required']);
        return response()->json(['data' => $twoFactor->startSettings($request->user(), $data['purpose'], $data['password'], $request)]);
    }

    public function twoFactorConfirm(Request $request, TwoFactorService $twoFactor): JsonResponse
    {
        $data = $request->validate([
            'challenge_id' => ['required', 'string', 'size:26'],
            'code' => ['required', 'digits:'.(int) config('security.two_factor.code_length', 6)],
        ], ['challenge_id.required' => 'validation.two_factor_expired', 'code.required' => 'validation.two_factor_code_invalid', 'code.digits' => 'validation.two_factor_code_invalid']);
        $enabled = $twoFactor->confirmSettings($request->user(), $data['challenge_id'], $data['code'], $request);
        return response()->json(['data' => ['two_factor_enabled' => $enabled]]);
    }

    public function sessions(Request $request): JsonResponse
    {
        $currentSession = $request->hasSession() ? $request->session()->getId() : '';
        return response()->json(['data' => $this->settings->sessions($request->user(), $currentSession)]);
    }

    public function revokeSession(Request $request, string $handle): JsonResponse
    {
        $currentSession = $request->hasSession() ? $request->session()->getId() : '';
        $this->settings->revoke($request->user(), $handle, $currentSession, (string) $request->ip(), (string) $request->userAgent());

        return response()->json(['data' => ['revoked' => true]]);
    }

    public function revokeOthers(Request $request): JsonResponse
    {
        $currentSession = $request->hasSession() ? $request->session()->getId() : '';
        $this->settings->revokeOthers($request->user(), $currentSession, (string) $request->ip(), (string) $request->userAgent());

        return response()->json(['data' => ['revoked' => true]]);
    }
}