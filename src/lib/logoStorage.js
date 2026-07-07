const supabase = require("./supabaseClient");

// Supabase Storage-bucket för restaurangloggor. Skapas automatiskt vid
// första uppladdningen om den saknas, så ingen manuell klick-runda i
// Supabase Dashboard krävs (samma servicenyckel har redan admin-rättigheter
// för storage, precis som för databasen).
const BUCKET = "logos";
const EXTENSIONS = ["png", "jpg", "jpeg", "webp"];

let bucketReady = null;

function ensureBucket() {
  if (!bucketReady) {
    bucketReady = (async () => {
      const { data: buckets } = await supabase.storage.listBuckets();
      const exists = (buckets || []).some((bucket) => bucket.name === BUCKET);
      if (!exists) {
        await supabase.storage.createBucket(BUCKET, {
          public: true,
          fileSizeLimit: "3MB",
        });
      }
    })();
  }
  return bucketReady;
}

async function uploadLogo(restaurantId, buffer, ext, contentType) {
  await ensureBucket();

  const path = `${restaurantId}/logo.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, {
    contentType,
    upsert: true,
  });
  if (error) throw error;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  // Cache-bust: samma filnamn skrivs över vid varje ny uppladdning (upsert),
  // så en versionsparameter behövs för att gästsidan inte ska visa en
  // cachad gammal bild.
  return `${data.publicUrl}?v=${Date.now()}`;
}

async function removeLogo(restaurantId) {
  await ensureBucket();
  await supabase.storage.from(BUCKET).remove(EXTENSIONS.map((ext) => `${restaurantId}/logo.${ext}`));
}

module.exports = { uploadLogo, removeLogo };
