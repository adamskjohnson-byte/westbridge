<?php

namespace App\Exceptions\Bank;

class AccountClosedException extends BankException
{
    public function __construct()
    {
        parent::__construct('A closed account cannot be used for a transfer.');
    }

    public function machineCode(): string
    {
        return 'account_closed';
    }
}
