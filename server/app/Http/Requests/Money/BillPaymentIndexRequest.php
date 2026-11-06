<?php

namespace App\Http\Requests\Money;

use Illuminate\Foundation\Http\FormRequest;

class BillPaymentIndexRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return ['page' => ['sometimes', 'integer', 'min:1']];
    }

    public function messages(): array
    {
        return [
            'page.integer' => 'validation.page_invalid',
            'page.min' => 'validation.page_invalid',
        ];
    }
}
