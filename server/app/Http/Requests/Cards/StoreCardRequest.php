<?php

namespace App\Http\Requests\Cards;

use Illuminate\Foundation\Http\FormRequest;

class StoreCardRequest extends FormRequest
{
    public function authorize(): bool { return true; }
    public function rules(): array { return ['account_id' => ['required', 'integer', 'min:1'], 'nickname' => ['sometimes', 'nullable', 'string', 'max:30']]; }
    public function messages(): array { return ['account_id.required' => 'validation.account_required', 'nickname.max' => 'validation.nickname_max']; }
}