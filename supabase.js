const SUPABASE_URL = "https://aloytwxdxzavovmmxebq.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFsb3l0d3hkeHphdm92bW14ZWJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4NDA2MDIsImV4cCI6MjA4ODQxNjYwMn0.8PNpt3lECsia9rIqrYnK7vrJJN2QBQevJ8trO8-qcuA";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

window.db = {
  client: supabaseClient,

  async syncProducts(productSeed) {
    const { data: existing, error: fetchError } = await supabaseClient
      .from("products")
      .select("id");

    if (fetchError) throw fetchError;

    const existingIds = new Set((existing || []).map(p => Number(p.id)));
    const missing = productSeed
      .filter(p => !existingIds.has(Number(p.id)))
      .map(p => ({
        id: Number(p.id),
        image_url: p.image_url,
        stock: 0
      }));

    if (missing.length > 0) {
      const { error: insertError } = await supabaseClient
        .from("products")
        .insert(missing);

      if (insertError) throw insertError;
    }

    for (const product of productSeed) {
      const { error: updateError } = await supabaseClient
        .from("products")
        .update({ image_url: product.image_url })
        .eq("id", product.id);

      if (updateError) throw updateError;
    }
  },

  async getProducts() {
    const { data, error } = await supabaseClient
      .from("products")
      .select("*")
      .order("id", { ascending: true });

    if (error) throw error;
    return data || [];
  },

  async increaseStock(productId) {
    const { error } = await supabaseClient.rpc("increment_product_stock", {
      p_product_id: productId,
      p_delta: 1
    });

    if (error) throw error;
  },

  async createSaleAndDecreaseStock(payload) {
    const { data, error } = await supabaseClient.rpc("create_sale_and_decrement_stock", {
      p_product_id: payload.product_id,
      p_price: payload.price,
      p_client: payload.client,
      p_sale_date: payload.sale_date,
      p_sale_time: payload.sale_time,
      p_payment_status: payload.payment_status,
      p_payment_method: payload.payment_method
    });

    if (error) throw error;
    return data;
  },

  async getSales(limit = 20, offset = 0) {
    const to = offset + limit - 1;
    const { data, error } = await supabaseClient
      .from("sales")
      .select("*")
      .order("created_at", { ascending: false })
      .range(offset, to);

    if (error) throw error;
    return data || [];
  },

  async getSalesCount() {
    const { count, error } = await supabaseClient
      .from("sales")
      .select("*", { count: "exact", head: true });

    if (error) throw error;
    return count || 0;
  },

  async updateSaleStatus(saleId, payment_status) {
    const { error } = await supabaseClient
      .from("sales")
      .update({ payment_status })
      .eq("id", saleId);

    if (error) throw error;
  },

  async updateSaleObservations(saleId, observations) {
    const { error } = await supabaseClient
      .from("sales")
      .update({ observations })
      .eq("id", saleId);

    if (error) throw error;
  },

  async getAffiliates() {
    const { data, error } = await supabaseClient
      .from("affiliates")
      .select("*")
      .order("name", { ascending: true });

    if (error) throw error;
    return data || [];
  },

  async addAffiliate(name, imageUrl) {
    const { error } = await supabaseClient
      .from("affiliates")
      .insert({
        name,
        image_url: imageUrl
      });

    if (error) throw error;
  },

  async removeAffiliate(id) {
    const { error } = await supabaseClient
      .from("affiliates")
      .delete()
      .eq("id", id);

    if (error) throw error;
  },

  async changeAffiliateSalesCount(id, delta) {
    const { error } = await supabaseClient.rpc("change_affiliate_sales_count", {
      p_affiliate_id: id,
      p_delta: delta
    });

    if (error) throw error;
  },

  async insertWithdrawal(person_name, amount) {
    const { error } = await supabaseClient
      .from("withdrawals")
      .insert({
        person_name,
        amount
      });

    if (error) throw error;
  },

  async getBalances() {
    const { data, error } = await supabaseClient
      .from("balances")
      .select("*")
      .order("person_name", { ascending: true });

    if (error) throw error;
    return data || [];
  },

  async recalculateBalances() {
    const { error } = await supabaseClient.rpc("recalculate_balances");

    if (error) throw error;
  }
};
