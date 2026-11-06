<?php

namespace App\Exceptions\Bank;

class CardOperationException extends BankException
{
    public function __construct(private readonly string $machineCode)
    {
        parent::__construct(match ($machineCode) {
            'card_frozen' => 'The card is frozen.',
            'card_cancelled' => 'The card has been cancelled.',
            'account_frozen' => 'The linked account is frozen.',
            'insufficient_funds' => 'The account has insufficient funds.',
            'card_limit_exceeded' => 'The card daily limit would be exceeded.',
            default => 'The card operation could not be completed.',
        });
    }

    public function machineCode(): string
    {
        return $this->machineCode;
    }
}