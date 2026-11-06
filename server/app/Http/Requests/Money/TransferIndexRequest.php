<?php

namespace App\Http\Requests\Money;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class TransferIndexRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'page' => ['sometimes', 'integer', 'min:1'],
            'account_id' => ['sometimes', 'integer', 'min:1'],
            'direction' => ['sometimes', Rule::in(['in', 'out', 'own'])],
            'date_from' => ['sometimes', 'date_format:Y-m-d'],
            'date_to' => ['sometimes', 'date_format:Y-m-d'],
        ];
    }

    public function messages(): array
    {
        return [
            'page.integer' => 'validation.page_invalid',
            'page.min' => 'validation.page_invalid',
            'account_id.integer' => 'validation.account_invalid',
            'account_id.min' => 'validation.account_invalid',
            'direction.in' => 'validation.transfer_direction_invalid',
            'date_from.date_format' => 'validation.date_invalid',
            'date_to.date_format' => 'validation.date_invalid',
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            $user = $this->user();
            $accountId = $this->query('account_id');
            if ($accountId !== null && $user?->accounts()->whereKey($accountId)->exists() !== true) {
                abort(404);
            }
            $from = $this->query('date_from');
            $to = $this->query('date_to');
            if ($from !== null && $to !== null && $from > $to) {
                $validator->errors()->add('date_from', 'validation.date_range_order');
            }
        });
    }
}
