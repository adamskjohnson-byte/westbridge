<?php

namespace App\Exceptions\Bank;

class AccountNotFoundException extends BankException
{
    public function __construct()
    {
        parent::__construct('A transfer account could not be found.');
    }

    public function machineCode(): string
    {
        return 'account_not_found';
    }
}
