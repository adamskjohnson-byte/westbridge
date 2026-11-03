<?php

namespace App\Exceptions\Bank;

class UserNotFoundException extends BankException
{
    public function __construct()
    {
        parent::__construct('The initiating user could not be found.');
    }

    public function machineCode(): string
    {
        return 'user_not_found';
    }
}
