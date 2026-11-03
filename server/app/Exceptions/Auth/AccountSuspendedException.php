<?php

namespace App\Exceptions\Auth;

use RuntimeException;

class AccountSuspendedException extends RuntimeException
{
    public function __construct()
    {
        parent::__construct('This account is suspended.');
    }
}
