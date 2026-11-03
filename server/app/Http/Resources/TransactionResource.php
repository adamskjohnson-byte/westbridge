<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Carbon;

class TransactionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'reference' => $this->reference,
            'direction' => $this->direction instanceof \BackedEnum ? $this->direction->value : $this->direction,
            'category' => $this->category instanceof \BackedEnum ? $this->category->value : $this->category,
            'amount_cents' => (int) $this->amount_cents,
            'balance_after_cents' => (int) $this->balance_after_cents,
            'currency' => $this->currency,
            'description' => $this->description,
            'counterparty_name' => $this->counterparty_name,
            'posted_at' => Carbon::parse($this->posted_at, 'UTC')->utc()->toISOString(),
        ];
    }
}
