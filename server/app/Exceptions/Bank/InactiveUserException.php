<?php

namespace App\Exceptions\Bank;

class InactiveUserException extends BankException
{
    public function __construct()
    {
        parent::__construct('The initiating user is not active.');
    }

    public function machineCode(): string
    {
        return 'user_inactive';
    }
}
