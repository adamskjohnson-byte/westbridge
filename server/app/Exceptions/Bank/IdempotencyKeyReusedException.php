<?php

namespace App\Exceptions\Bank;

class IdempotencyKeyReusedException extends BankException
{
    public function __construct()
    {
        parent::__construct('This idempotency key was already used for a different request.');
    }

    public function machineCode(): string
    {
        return 'idempotency_key_reused';
    }
}
