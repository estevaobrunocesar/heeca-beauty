import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { checkImageUrl } from "../src/lib/storage/ownership";
import { S3Storage } from "../src/lib/storage/providers/s3";
import { LocalStorage } from "../src/lib/storage/providers/local";

const CDN = "https://cdn.heeca.com.br";

function s3(prefix: string) {
  process.env.S3_BUCKET = "heeca-public";
  process.env.S3_ACCESS_KEY_ID = "k";
  process.env.S3_SECRET_ACCESS_KEY = "s";
  process.env.S3_PUBLIC_URL = CDN;
  process.env.S3_PREFIX = prefix;
  return new S3Storage();
}

describe("S3Storage.keyFromUrl — chaves relativas ao produto", () => {
  it("devolve a chave SEM o prefixo da marca", () => {
    assert.equal(s3("beauty").keyFromUrl(`${CDN}/beauty/tenant1/logo/abc.webp`), "tenant1/logo/abc.webp");
  });
  it("sem prefixo configurado, a chave é o caminho inteiro", () => {
    assert.equal(s3("").keyFromUrl(`${CDN}/tenant1/logo/abc.webp`), "tenant1/logo/abc.webp");
  });
  it("rejeita URL de outra marca no mesmo bucket", () => {
    assert.equal(s3("beauty").keyFromUrl(`${CDN}/wellness/tenant1/logo/abc.webp`), null);
  });
  it("rejeita host externo, mesmo com caminho parecido", () => {
    assert.equal(s3("beauty").keyFromUrl("https://imgur.com/beauty/tenant1/logo/abc.webp"), null);
    assert.equal(s3("beauty").keyFromUrl(`${CDN}.evil.com/beauty/tenant1/x.webp`), null);
  });
  it("rejeita travessia de diretório e query string", () => {
    assert.equal(s3("beauty").keyFromUrl(`${CDN}/beauty/../wellness/t/x.webp`), null);
    assert.equal(s3("beauty").keyFromUrl(`${CDN}/beauty/tenant1/x.webp?x=1`), null);
  });
});

describe("LocalStorage.keyFromUrl (dev)", () => {
  const local = new LocalStorage();
  it("reconhece /uploads/<chave> e rejeita o resto", () => {
    assert.equal(local.keyFromUrl("http://localhost:3000/uploads/t1/logo/a.webp"), "t1/logo/a.webp");
    assert.equal(local.keyFromUrl("https://imgur.com/a.png"), null);
    assert.equal(local.keyFromUrl("http://localhost:3000/uploads/../etc/passwd"), null);
  });
});

describe("checkImageUrl — regra da plataforma: só upload, só do próprio salão", () => {
  let provider: S3Storage;
  const keyOf = (u: string) => provider.keyFromUrl(u);
  beforeEach(() => { provider = s3("beauty"); });

  it("aceita a imagem enviada para a pasta do próprio estabelecimento", () => {
    const url = `${CDN}/beauty/t1/portfolio/x.webp`;
    assert.deepEqual(checkImageUrl("t1", url, keyOf), { ok: true, url });
  });
  it("campo vazio é válido e vira null (imagem opcional/removida)", () => {
    assert.deepEqual(checkImageUrl("t1", "", keyOf), { ok: true, url: null });
    assert.deepEqual(checkImageUrl("t1", "   ", keyOf), { ok: true, url: null });
    assert.deepEqual(checkImageUrl("t1", undefined, keyOf), { ok: true, url: null });
  });
  it("recusa URL externa colada (a regra)", () => {
    assert.deepEqual(checkImageUrl("t1", "https://i.imgur.com/abc.jpg", keyOf), { ok: false });
    assert.deepEqual(checkImageUrl("t1", "https://images.unsplash.com/photo-1?w=800", keyOf), { ok: false });
  });
  it("recusa arquivo de OUTRO estabelecimento do mesmo bucket", () => {
    assert.deepEqual(checkImageUrl("t1", `${CDN}/beauty/t2/portfolio/x.webp`, keyOf), { ok: false });
  });
  it("recusa tenant que só começa igual (t1 vs t10)", () => {
    assert.deepEqual(checkImageUrl("t1", `${CDN}/beauty/t10/portfolio/x.webp`, keyOf), { ok: false });
  });
  it("recusa arquivo de outra marca", () => {
    assert.deepEqual(checkImageUrl("t1", `${CDN}/wellness/t1/portfolio/x.webp`, keyOf), { ok: false });
  });
  it("dado legado (URL externa já gravada) é mantido enquanto não for trocado", () => {
    const legacy = "https://i.imgur.com/abc.jpg";
    assert.deepEqual(checkImageUrl("t1", legacy, keyOf, legacy), { ok: true, url: legacy });
    // …mas outra URL externa continua recusada, mesmo havendo legado
    assert.deepEqual(checkImageUrl("t1", "https://i.imgur.com/outra.jpg", keyOf, legacy), { ok: false });
  });
});
