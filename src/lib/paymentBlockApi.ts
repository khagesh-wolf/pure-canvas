// API for managing payment blocks (3-hour cooldown after bill payment)
import { supabase } from './supabase';

export interface PaymentBlockCheck {
  is_blocked: boolean;
  paid_at: string | null;
  block_id: number | null;
}

/**
 * Check if a customer is blocked from ordering at a table
 * (paid within 3 hours and no staff override)
 */
export async function checkPaymentBlock(
  tableNumber: number,
  customerPhone: string
): Promise<PaymentBlockCheck | null> {
  try {
    const { data, error } = await supabase.rpc('check_payment_block', {
      p_table_number: tableNumber,
      p_customer_phone: customerPhone
    });

    if (error) {
      console.error('[PaymentBlockAPI] Error checking block:', error);
      return null;
    }

    // RPC returns array, get first result
    if (data && data.length > 0) {
      return data[0] as PaymentBlockCheck;
    }

    // No block found
    return { is_blocked: false, paid_at: null, block_id: null };
  } catch (err) {
    console.error('[PaymentBlockAPI] Exception checking block:', err);
    return null;
  }
}

/**
 * Record a payment block when bill is paid
 */
export async function recordPaymentBlock(
  tableNumber: number,
  customerPhone: string
): Promise<number | null> {
  try {
    const { data, error } = await supabase.rpc('record_payment_block', {
      p_table_number: tableNumber,
      p_customer_phone: customerPhone
    });

    if (error) {
      console.error('[PaymentBlockAPI] Error recording block:', error);
      return null;
    }

    console.log(`[PaymentBlockAPI] Recorded payment block for table ${tableNumber}, phone ${customerPhone}`);
    return data as number;
  } catch (err) {
    console.error('[PaymentBlockAPI] Exception recording block:', err);
    return null;
  }
}

/**
 * Override a payment block (staff confirmation)
 */
export async function overridePaymentBlock(blockId: number): Promise<boolean> {
  try {
    // Use p_id as the parameter name (matches the database function signature)
    const { data, error } = await supabase.rpc('override_payment_block', {
      p_id: blockId
    });

    if (error) {
      console.error('[PaymentBlockAPI] Error overriding block:', error);
      return false;
    }

    console.log(`[PaymentBlockAPI] Overridden payment block ${blockId}`);
    return data as boolean;
  } catch (err) {
    console.error('[PaymentBlockAPI] Exception overriding block:', err);
    return false;
  }
}

/**
 * Record payment blocks for multiple customer phones
 */
export async function recordPaymentBlocksForPhones(
  tableNumber: number,
  customerPhones: string[]
): Promise<void> {
  try {
    await Promise.all(
      customerPhones.map(phone => recordPaymentBlock(tableNumber, phone))
    );
    console.log(`[PaymentBlockAPI] Recorded ${customerPhones.length} payment blocks for table ${tableNumber}`);
  } catch (err) {
    console.error('[PaymentBlockAPI] Exception recording multiple blocks:', err);
  }
}
