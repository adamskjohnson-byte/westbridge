<?php

namespace App\Http\Requests\Money;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class StoreTransferRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        if (is_string($this->input('memo'))) {
            $memo = preg_replace('/[\x00-\x1F\x7F]/u', '', $this->input('memo'));
            $this->merge(['memo' => trim((string) $memo) ?: null]);
        }
    }

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
            'amount_cents' => ['required', 'integer'],
            'memo' => ['sometimes', 'nullable', 'string', 'max:140'],
            'to_type' => ['required', Rule::in(['own', 'beneficiary', 'account_number'])],
            'to_account_id' => ['required_if:to_type,own', 'prohibited_unless:to_type,own', 'integer', 'min:1'],
            'beneficiary_id' => ['required_if:to_type,beneficiary', 'prohibited_unless:to_type,beneficiary', 'integer', 'min:1'],
            'account_number' => ['required_if:to_type,account_number', 'prohibited_unless:to_type,account_number', 'string', 'regex:/^\d{10}$/'],
        ];
    }

    public function messages(): array
    {
        return [
            'from_account_id.required' => 'validation.account_required',
            'from_account_id.integer' => 'validation.account_invalid',
            'amount_cents.required' => 'validation.amount_invalid',
            'amount_cents.integer' => 'validation.amount_invalid',
            'memo.max' => 'validation.memo_max',
            'to_type.required' => 'validation.destination_required',
            'to_type.in' => 'validation.destination_invalid',
            'to_account_id.required_if' => 'validation.destination_required',
            'to_account_id.prohibited_unless' => 'validation.destination_exclusive',
            'beneficiary_id.required_if' => 'validation.destination_required',
            'beneficiary_id.prohibited_unless' => 'validation.destination_exclusive',
            'account_number.required_if' => 'validation.destination_required',
            'account_number.prohibited_unless' => 'validation.destination_exclusive',
            'account_number.regex' => 'validation.account_number_invalid',
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
