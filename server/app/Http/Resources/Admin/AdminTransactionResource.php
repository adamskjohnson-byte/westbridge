<?php

namespace App\Http\Resources\Admin;

use App\Services\Admin\AdminService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Carbon;

class AdminTransactionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $direction = $this->direction instanceof \BackedEnum ? $this->direction->value : (string) $this->direction;
        $category = $this->category instanceof \BackedEnum ? $this->category->value : (string) $this->category;
        return [
            'id' => (int) $this->id,
            'reference' => $this->reference,
            'direction' => $direction,
            'category' => $category,
            'amount_cents' => (int) $this->amount_cents,
            'balance_after_cents' => (int) $this->balance_after_cents,
            'description' => $this->description,
            'counterparty_name' => $this->counterparty_name,
            'posted_at' => $this->posted_at === null ? null : Carbon::parse($this->posted_at)->toISOString(),
            'flagged_large' => (int) $this->amount_cents >= (int) config('bank.admin_large_transaction_cents'),
            'user' => ['id' => (int) $this->user_id, 'name' => trim($this->user_first_name.' '.$this->user_last_name), 'email' => $this->user_email],
            'account' => ['id' => (int) $this->account_id, 'type' => $this->account_type, 'number_masked' => AdminService::maskAccountNumber($this->account_number)],
        ];
    }
}
