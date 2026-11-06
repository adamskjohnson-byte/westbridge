<?php

namespace App\Http\Resources;

use App\Services\BeneficiaryService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class TransferResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $transaction = $this->transactions->firstWhere('account_id', $this->from_account_id);

        return [
            'id' => $this->id,
            'reference' => $transaction?->reference,
            'status' => $this->status instanceof \BackedEnum ? $this->status->value : $this->status,
            'amount_cents' => (int) $this->amount_cents,
            'currency' => $this->currency,
            'memo' => $this->memo,
            'from' => [
                'account_id' => (int) $this->from_account_id,
                'type' => $this->fromAccount?->type?->value ?? $this->fromAccount?->type,
                'number_masked' => BeneficiaryService::maskAccountNumber((string) $this->fromAccount?->account_number),
            ],
            'to' => [
                'type' => $this->destination_type,
                'number_masked' => $this->destination_number_masked,
                'holder_masked' => $this->destination_holder_masked,
            ],
            'created_at' => $this->created_at?->utc()->toISOString(),
            'balance_after_cents' => (int) ($transaction?->balance_after_cents ?? 0),
        ];
    }
}
