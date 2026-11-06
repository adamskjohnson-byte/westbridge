<?php

namespace App\Http\Requests\Cards;

use Illuminate\Foundation\Http\FormRequest;

class UpdateCardRequest extends FormRequest
{
    public function authorize(): bool { return true; }
    public function rules(): array
    {
        return [
            'nickname' => ['sometimes', 'nullable', 'string', 'max:30'],
            'daily_limit_cents' => ['sometimes', 'integer', 'min:0', 'max:'.(int) config('bank.card_daily_limit_max_cents', 500000)],
        ];
    }
    public function messages(): array
    {
        return ['nickname.max' => 'validation.nickname_max', 'daily_limit_cents.integer' => 'validation.card_limit_invalid', 'daily_limit_cents.min' => 'validation.card_limit_invalid', 'daily_limit_cents.max' => 'validation.card_limit_invalid'];
    }
}