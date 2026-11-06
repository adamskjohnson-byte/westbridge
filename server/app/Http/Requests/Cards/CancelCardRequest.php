<?php

namespace App\Http\Requests\Cards;

use Illuminate\Foundation\Http\FormRequest;

class CancelCardRequest extends FormRequest
{
    public function authorize(): bool { return true; }
    public function rules(): array { return ['confirm' => ['required', 'accepted']]; }
    public function messages(): array { return ['confirm.required' => 'validation.card_cancel_confirmation_required', 'confirm.accepted' => 'validation.card_cancel_confirmation_required']; }
}