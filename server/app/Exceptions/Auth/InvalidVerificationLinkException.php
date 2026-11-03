<?php

namespace App\Exceptions\Auth;

use RuntimeException;

class InvalidVerificationLinkException extends RuntimeException
{
    public function __construct()
    {
        parent::__construct('This email verification link is invalid or has expired.');
    }
}
