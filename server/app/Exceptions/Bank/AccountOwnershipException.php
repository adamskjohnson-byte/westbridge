<?php

namespace App\Exceptions\Bank;

class AccountOwnershipException extends BankException
{
    public function __construct()
    {
        parent::__construct('The initiator does not own the source account.');
    }

    public function machineCode(): string
    {
        return 'account_not_owned';
    }
}
