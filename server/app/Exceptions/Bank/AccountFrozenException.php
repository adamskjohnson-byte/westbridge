<?php

namespace App\Exceptions\Bank;

class AccountFrozenException extends BankException
{
    public function __construct()
    {
        parent::__construct('A frozen account cannot be used for a transfer.');
    }

    public function machineCode(): string
    {
        return 'account_frozen';
    }
}
