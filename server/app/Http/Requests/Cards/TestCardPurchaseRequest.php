<?php

namespace App\Http\Requests\Cards;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Validator;

class TestCardPurchaseRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        if (is_string($this->input('merchant'))) {
            $this->merge(['merchant' => preg_replace('/[\x00-\x1F\x7F]/u', '', $this->input('merchant'))]);
        }
    }
    public function authorize(): bool { return true; }
    public function rules(): array { return ['merchant' => ['required', 'string', 'min:2', 'max:60'], 'amount_cents' => ['required', 'integer', 'min:1', 'max:1000000']]; }
    public function messages(): array
    {
        return ['merchant.required' => 'validation.merchant_required', 'merchant.min' => 'validation.merchant_invalid', 'merchant.max' => 'validation.merchant_invalid', 'amount_cents.required' => 'validation.amount_invalid', 'amount_cents.integer' => 'validation.amount_invalid', 'amount_cents.min' => 'validation.amount_invalid', 'amount_cents.max' => 'validation.amount_invalid'];
    }
    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            if (! is_string($this->header('Idempotency-Key')) || ! Str::isUuid($this->header('Idempotency-Key'))) {
                $validator->errors()->add('idempotency_key', 'validation.idempotency_key_required');
            }
        });
    }
}