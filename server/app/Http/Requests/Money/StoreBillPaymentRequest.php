<?php

namespace App\Http\Requests\Money;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Validator;

class StoreBillPaymentRequest extends FormRequest
{
    public function authorize(): bool
    {
        $sourceId = $this->input('from_account_id');
        if (is_numeric($sourceId) && $this->user()?->accounts()->whereKey((int) $sourceId)->exists() !== true) {
            abort(404);
        }

        return true;
    }

    public function rules(): array
    {
        return [
            'from_account_id' => ['required', 'integer', 'min:1'],
            'biller_code' => ['required', 'string', 'max:40'],
            'reference_number' => ['required', 'string', 'max:40'],
            'amount_cents' => ['required', 'integer'],
        ];
    }

    public function messages(): array
    {
        return [
            'from_account_id.required' => 'validation.account_required',
            'from_account_id.integer' => 'validation.account_invalid',
            'biller_code.required' => 'validation.biller_required',
            'reference_number.required' => 'validation.reference_required',
            'reference_number.max' => 'validation.reference_invalid',
            'amount_cents.required' => 'validation.amount_invalid',
            'amount_cents.integer' => 'validation.amount_invalid',
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            $key = $this->header('Idempotency-Key');
            if (! is_string($key) || ! Str::isUuid($key)) {
                $validator->errors()->add('idempotency_key', 'validation.idempotency_key_required');
            }
        });
    }

    public function idempotencyKey(): string
    {
        return (string) $this->header('Idempotency-Key');
    }
}
