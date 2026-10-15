package com.kharchabaki.app.ui

import com.kharchabaki.app.data.Loan
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class LoansScreenTest {
    @Test fun `messaging is available only for lent loans with a phone number`() {
        assertTrue(canMessageLoan(Loan(kind = "given", phoneNumber = "+15551234567")))
        assertFalse(canMessageLoan(Loan(kind = "given")))
        assertFalse(canMessageLoan(Loan(kind = "taken", phoneNumber = "+15551234567")))
        assertFalse(canMessageLoan(Loan(kind = "given", phoneNumber = "  ")))
    }

    @Test fun `prefilled message stays generic`() {
        assertEquals("Hi, this is a reminder about the amount we discussed. Please let me know when you can repay it.", loanMessageBody)
    }
}
