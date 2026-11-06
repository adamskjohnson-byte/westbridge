<?php

namespace App\Http\Resources\Admin;

use App\Services\Admin\AdminService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AdminUserDetailResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $user = $this->resource['user'];
        return [
            'id' => (int) $user->id,
            'first_name' => $user->first_name,
            'last_name' => $user->last_name,
            'email' => $user->email,
            'phone' => $user->phone,
            'role' => $user->role->value,
            'status' => $user->status->value,
            'email_verified' => $user->email_verified_at !== null,
            'created_at' => $user->created_at?->toISOString(),
            'last_login_at' => $user->last_login_at?->toISOString(),
            'accounts' => $user->accounts->map(fn ($account): array => [
                'id' => (int) $account->id,
                'type' => $account->type->value,
                'number_masked' => AdminService::maskAccountNumber($account->account_number),
                'balance_cents' => (int) $account->balance_cents,
                'status' => $account->status->value,
            ])->all(),
            'cards_count' => (int) $user->cards_count,
            'open_tickets_count' => (int) $user->open_tickets_count,
            'active_sessions_count' => (int) $this->resource['activeSessions'],
            'transactions' => AdminTransactionResource::collection($this->resource['transactions']),
            'audit_events' => AdminAuditLogResource::collection($this->resource['audit']),
        ];
    }
}
