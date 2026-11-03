<?php

namespace App\Http\Requests\Auth;

use Closure;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Password;

class RegisterRequest extends FormRequest
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
                if (! preg_match('/[a-z]/', $value)) {
                    $fail('validation.password_lowercase');
                }
            },
            static function (string $attribute, mixed $value, Closure $fail): void {
                if (! preg_match('/[A-Z]/', $value)) {
                    $fail('validation.password_uppercase');
                }
            },
            static function (string $attribute, mixed $value, Closure $fail): void {
                if (! preg_match('/[0-9]/', $value)) {
                    $fail('validation.password_number');
                }
            },
            'confirmed',
        ];
        if (app()->environment('production')) {
            $password[] = Password::min(10)->uncompromised();
        }

        return [
            'first_name' => ['required', 'string', 'min:2', 'max:60'],
            'last_name' => ['required', 'string', 'min:2', 'max:60'],
            'email' => ['required', 'string', 'email:rfc', 'max:254', 'unique:users,email'],
            'password' => $password,
            'password_confirmation' => ['required', 'string'],
            'accept_terms' => ['accepted'],
        ];
    }

    public function messages(): array
    {
        return [
            'first_name.required' => 'validation.name_required',
            'first_name.string' => 'validation.name_invalid',
            'first_name.min' => 'validation.name_min',
            'first_name.max' => 'validation.name_max',
            'last_name.required' => 'validation.name_required',
            'last_name.string' => 'validation.name_invalid',
            'last_name.min' => 'validation.name_min',
            'last_name.max' => 'validation.name_max',
            'email.required' => 'validation.email_required',
            'email.string' => 'validation.email_invalid',
            'email.email' => 'validation.email_invalid',
            'email.max' => 'validation.email_max',
            'email.unique' => 'validation.email_taken',
            'password.required' => 'validation.password_required',
            'password.string' => 'validation.password_invalid',
            'password.min' => 'validation.password_min',
            'password.confirmed' => 'validation.password_confirmed',
            'password.uncompromised' => 'validation.password_compromised',
            'password_confirmation.required' => 'validation.password_confirmation_required',
            'password_confirmation.string' => 'validation.password_invalid',
            'accept_terms.accepted' => 'validation.terms_required',
        ];
    }
}
