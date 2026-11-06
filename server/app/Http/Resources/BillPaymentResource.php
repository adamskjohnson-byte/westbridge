<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class BillPaymentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'biller_code' => $this->biller_code,
            'biller_name' => $this->biller_name,
            'reference_number' => $this->reference_number,
            'amount_cents' => (int) $this->amount_cents,
            'currency' => $this->account?->currency ?? config('bank.default_currency', 'USD'),
            'status' => $this->status,
            'transaction_id' => (int) $this->transaction_id,
            'transaction_reference' => $this->transaction?->reference,
            'created_at' => $this->created_at?->utc()->toISOString(),
        ];
    }
}
