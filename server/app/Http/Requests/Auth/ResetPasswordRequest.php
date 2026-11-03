<?php

namespace App\Http\Requests\Auth;

use Closure;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Password;

class ResetPasswordRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        $this->merge(['email' => strtolower(trim((string) $this->input('email')))]);
    }

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $password = [
            'required',
            'string',
            'min:10',
            static function (string $attribute, mixed $value, Closure $fail): void {
                if (! is_string($value) || ! preg_match('/[a-z]/', $value)) {
                    $fail('validation.password_lowercase');
                }
            },
            static function (string $attribute, mixed $value, Closure $fail): void {
                if (! is_string($value) || ! preg_match('/[A-Z]/', $value)) {
                    $fail('validation.password_uppercase');
                }
            },
            static function (string $attribute, mixed $value, Closure $fail): void {
                if (! is_string($value) || ! preg_match('/[0-9]/', $value)) {
                    $fail('validation.password_number');
                }
            },
            'confirmed',
        ];
        if (app()->environment('production')) {
            $password[] = Password::min(10)->uncompromised();
        }

        return [
            'token' => ['required', 'string'],
            'email' => ['required', 'string', 'email:rfc', 'max:254'],
            'password' => $password,
            'password_confirmation' => ['required', 'string'],
        ];
    }

    public function messages(): array
    {
        return [
            'token.required' => 'validation.reset_token_required',
            'token.string' => 'validation.reset_token_invalid',
            'email.required' => 'validation.email_required',
            'email.string' => 'validation.email_invalid',
            'email.email' => 'validation.email_invalid',
            'email.max' => 'validation.email_max',
            'password.required' => 'validation.password_required',
            'password.string' => 'validation.password_invalid',
            'password.min' => 'validation.password_min',
            'password.confirmed' => 'validation.password_confirmed',
            'password.uncompromised' => 'validation.password_compromised',
            'password_confirmation.required' => 'validation.password_confirmation_required',
            'password_confirmation.string' => 'validation.password_invalid',
        ];
    }
}
