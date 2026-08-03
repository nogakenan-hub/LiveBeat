import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://djygajgvpzdqddexyrgn.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqeWdhamd2cHpkcWRkZXh5cmduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyMzA1MDMsImV4cCI6MjA5NjgwNjUwM30.jwIpUNOMcLNfQTy6FDrqbLEMQTde4NmyoknEXWL_ruU';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);