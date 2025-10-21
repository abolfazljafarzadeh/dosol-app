import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🛍️ Fetching courses from WooCommerce...');
    
    const wooUrl = 'https://dosol.ir/wp-json/wc/v3/products';
    const consumerKey = Deno.env.get('WOOCOMMERCE_CONSUMER_KEY')!;
    const consumerSecret = Deno.env.get('WOOCOMMERCE_CONSUMER_SECRET')!;

    console.log('🔑 Using consumer key:', consumerKey?.substring(0, 10) + '...');

    // Build URL with query parameters (standard for WooCommerce REST API over HTTPS)
    const params = new URLSearchParams({
      consumer_key: consumerKey,
      consumer_secret: consumerSecret,
      per_page: '50',
      status: 'publish',
    });

    const fullUrl = `${wooUrl}?${params.toString()}`;
    
    console.log('📞 Calling:', fullUrl.replace(consumerSecret, '***'));

    // Fetch products from WooCommerce
    const response = await fetch(fullUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('❌ WooCommerce API error:', response.status);
      throw new Error(`WooCommerce API error: ${response.status}`);
    }

    const products = await response.json();
    console.log(`✅ Fetched ${products.length} products from WooCommerce`);

    // Transform WooCommerce products to course format
    const courses = products.map((product: any) => {
      const isOnSale = product.on_sale;
      const regularPrice = parseFloat(product.regular_price || '0');
      const salePrice = parseFloat(product.sale_price || '0');
      
      // Extract custom fields
      const videoUrl = product.meta_data?.find((m: any) => m.key === 'course_introduction_video')?.value || '';
      
      // Get video cover - it might be an ID, so we need to find the actual image URL
      const videoCoverId = product.meta_data?.find((m: any) => m.key === 'course_introduction_video_cover')?.value || '';
      let videoCover = '';
      
      if (videoCoverId) {
        // Try to find the image in product.images by ID
        const videoCoverImage = product.images?.find((img: any) => img.id === parseInt(videoCoverId));
        videoCover = videoCoverImage?.src || '';
      }
      
      // Fallback to first product image if no cover found
      if (!videoCover) {
        videoCover = product.images?.[0]?.src || '';
      }
      
      const instructor = product.meta_data?.find((m: any) => m.key === 'instructor')?.value || 'مدرس دوسل';
      const studentsCount = parseInt(product.meta_data?.find((m: any) => m.key === 'students_count')?.value || '0');
      const rating = parseFloat(product.average_rating || '0');
      
      console.log(`📦 ${product.name}:`, { videoUrl: videoUrl || 'NONE', videoCover: videoCover || 'NONE', videoCoverId });
      
      return {
        id: product.id,
        title: product.name,
        description: product.short_description?.replace(/<[^>]*>/g, '') || product.description?.replace(/<[^>]*>/g, '').substring(0, 200) || '',
        price: regularPrice,
        discountPrice: isOnSale ? salePrice : null,
        discountPercent: isOnSale ? Math.round(((regularPrice - salePrice) / regularPrice) * 100) : null,
        discountEndDate: product.date_on_sale_to || null,
        image: videoCover,
        instructor: instructor,
        studentsCount: studentsCount,
        rating: rating,
        category: product.categories?.[0]?.name || 'دوره',
        videoUrl: videoUrl,
        level: product.meta_data?.find((m: any) => m.key === 'level')?.value || 'مبتدی',
        duration: product.meta_data?.find((m: any) => m.key === 'duration')?.value || null,
      };
    });

    return new Response(
      JSON.stringify({ ok: true, courses }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: any) {
    console.error('Error fetching courses:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
