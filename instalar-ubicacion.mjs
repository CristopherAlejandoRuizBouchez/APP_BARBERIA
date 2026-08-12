import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const files = {
  editor: 'src/components/panel/editor-apariencia.tsx',
  panelPage: 'src/app/(panel)/panel/[organizationSlug]/[modulo]/page.tsx',
  actions: 'src/app/(panel)/panel/[organizationSlug]/acciones.ts',
  publicHome: 'src/app/b/[slug]/page.tsx',
  contact: 'src/app/b/[slug]/contacto/page.tsx',
};

function countLiteral(text, needle) {
  return text.split(needle).length - 1;
}

function replaceLiteral(text, needle, replacement, label) {
  const count = countLiteral(text, needle);
  if (count !== 1) {
    throw new Error(`${label}: se esperaba encontrar un bloque una vez, pero apareció ${count}.`);
  }
  return text.replace(needle, replacement);
}

function replaceRegex(text, regex, replacement, label) {
  const matches = [...text.matchAll(regex)];
  if (matches.length !== 1) {
    throw new Error(
      `${label}: se esperaba encontrar un bloque una vez, pero apareció ${matches.length}.`
    );
  }
  return text.replace(regex, replacement);
}

function patchEditor(source) {
  let text = source;
  text = replaceRegex(
    text,
    /Loader2,\s*RotateCcw/gu,
    'Loader2, MapPin, RotateCcw',
    'Importación de MapPin'
  );

  text = replaceLiteral(
    text,
    'type Colores = Pick<',
    `type UbicacionInicialEditor = {
  ciudad: string;
  calle: string;
  numero: string;
  colonia: string;
};

type Colores = Pick<`,
    'Tipo de ubicación'
  );

  text = replaceLiteral(
    text,
    `  temaInicial,
  action,`,
    `  temaInicial,
  ubicacionInicial,
  action,`,
    'Propiedad de ubicación'
  );

  text = replaceLiteral(
    text,
    `  temaInicial: TemaInicialEditor;
  action:`,
    `  temaInicial: TemaInicialEditor;
  ubicacionInicial: UbicacionInicialEditor;
  action:`,
    'Tipo de propiedad de ubicación'
  );

  const buttonBlock =
    '        <div className="flex flex-wrap items-center gap-3 border-t border-[var(--borde)] pt-5">';
  const locationSection = `        <section className="border border-[var(--borde)] bg-[var(--superficie)] p-5">
          <div className="mb-5">
            <p className="etiqueta text-dorado">Paso 5</p>
            <div className="mt-2 flex items-center gap-3">
              <MapPin className="size-5 text-dorado" aria-hidden="true" />
              <h2 className="font-display text-2xl">Ubicación</h2>
            </div>
            <p className="mt-2 text-sm text-[var(--texto-suave)]">
              Esta dirección aparecerá en la página pública con un mapa y un botón para llegar.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo etiqueta="Ciudad" htmlFor="ciudad">
              <Entrada
                id="ciudad"
                name="ciudad"
                defaultValue={ubicacionInicial.ciudad}
                placeholder="Xalapa, Veracruz"
                maxLength={100}
                required
              />
            </Campo>

            <Campo etiqueta="Colonia" htmlFor="colonia">
              <Entrada
                id="colonia"
                name="colonia"
                defaultValue={ubicacionInicial.colonia}
                placeholder="Colonia Centro"
                maxLength={120}
              />
            </Campo>

            <Campo etiqueta="Calle" htmlFor="calle">
              <Entrada
                id="calle"
                name="calle"
                defaultValue={ubicacionInicial.calle}
                placeholder="Avenida, calle o carretera"
                maxLength={180}
                required
              />
            </Campo>

            <Campo etiqueta="Número" htmlFor="numero">
              <Entrada
                id="numero"
                name="numero"
                defaultValue={ubicacionInicial.numero}
                placeholder="123, interior 2"
                maxLength={40}
              />
            </Campo>
          </div>

          <div className="mt-4 border border-dorado/30 bg-dorado/5 p-4 text-sm">
            <strong className="block text-dorado">Mapa automático</strong>
            <p className="mt-1 text-[var(--texto-suave)]">
              Google Maps localizará la barbería utilizando la dirección capturada. No necesita una API de pago.
            </p>
          </div>
        </section>

${buttonBlock}`;

  text = replaceLiteral(text, buttonBlock, locationSection, 'Sección de ubicación');
  return text;
}

function patchPanelPage(source) {
  let text = source;
  text = replaceRegex(
    text,
    /const \{ data: tema \} = await supabase\s*\.from\('organization_themes'\)\s*\.select\('\*'\)\s*\.eq\('organization_id', orgId\)\s*\.maybeSingle\(\);/gu,
    `const [{ data: tema }, { data: ubicacion }] = await Promise.all([
      supabase
        .from('organization_themes')
        .select('*')
        .eq('organization_id', orgId)
        .maybeSingle(),
      supabase
        .from('locations')
        .select('ciudad, calle, numero, colonia')
        .eq('organization_id', orgId)
        .eq('activa', true)
        .order('es_principal', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);`,
    'Consulta de apariencia y ubicación'
  );

  text = replaceLiteral(
    text,
    `          sitioPublico={basePublica}
          action={guardarAparienciaOrg}`,
    `          sitioPublico={basePublica}
          ubicacionInicial={{
            ciudad: ubicacion?.ciudad ?? '',
            calle: ubicacion?.calle ?? '',
            numero: ubicacion?.numero ?? '',
            colonia: ubicacion?.colonia ?? '',
          }}
          action={guardarAparienciaOrg}`,
    'Datos iniciales de ubicación'
  );
  return text;
}

function patchActions(source) {
  const start = source.indexOf('export async function guardarApariencia');
  const end = source.indexOf('export async function crearAccesoRecepcion', start);
  if (start < 0 || end < 0) {
    throw new Error('No se encontró completa la acción guardarApariencia.');
  }

  let action = source.slice(start, end);
  const themeUpdate = `const { error } = await supabase
      .from('organization_themes')`;
  const validation = `const ubicacionValidada = z
      .object({
        ciudad: z.string().trim().min(2).max(100),
        calle: z.string().trim().min(2).max(180),
        numero: z.string().trim().max(40),
        colonia: z.string().trim().max(120),
      })
      .parse({
        ciudad: valor(formData, 'ciudad'),
        calle: valor(formData, 'calle'),
        numero: valor(formData, 'numero'),
        colonia: valor(formData, 'colonia'),
      });

    ${themeUpdate}`;
  action = replaceLiteral(action, themeUpdate, validation, 'Validación de ubicación');

  const finish = `if (error) throw error;
    revalidatePath(\`/b/\${slug}\`, 'layout');`;
  const updateLocation = `if (error) throw error;

    const { data: ubicacionActual, error: ubicacionConsultaError } = await supabase
      .from('locations')
      .select('id')
      .eq('organization_id', organizacion.id)
      .eq('activa', true)
      .order('es_principal', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (ubicacionConsultaError || !ubicacionActual) throw new Error('DATOS_INVALIDOS');

    const { error: ubicacionError } = await supabase
      .from('locations')
      .update({
        ciudad: ubicacionValidada.ciudad,
        calle: ubicacionValidada.calle,
        numero: ubicacionValidada.numero || null,
        colonia: ubicacionValidada.colonia || null,
      })
      .eq('organization_id', organizacion.id)
      .eq('id', ubicacionActual.id);
    if (ubicacionError) throw ubicacionError;

    revalidatePath(\`/b/\${slug}\`, 'layout');`;
  action = replaceLiteral(action, finish, updateLocation, 'Guardado de ubicación');
  return source.slice(0, start) + action + source.slice(end);
}

function patchPublicHome(source) {
  let text = source;
  text = replaceLiteral(
    text,
    `const listaBarberos = barberos.data ?? [];

const contenedor`,
    `const listaBarberos = barberos.data ?? [];
const ubicacion = sucursales[0] ?? null;
const direccionCompleta = ubicacion
  ? [ubicacion.direccionCorta, ubicacion.ciudad].filter(Boolean).join(', ')
  : '';
const consultaMapa = encodeURIComponent(direccionCompleta);
const urlMapa = direccionCompleta
  ? \`https://www.google.com/maps?q=\${consultaMapa}&output=embed\`
  : '';
const urlComoLlegar = direccionCompleta
  ? \`https://www.google.com/maps/search/?api=1&query=\${consultaMapa}\`
  : '';

const contenedor`,
    'Variables de mapa público'
  );

  const start = text.indexOf('{sucursales.length > 1 ? (');
  if (start < 0) throw new Error('No se encontró la sección actual de sucursales.');
  const rest = text.slice(start);
  const closingMarker = rest.match(/\{\/\*[^\r\n]*CIERRE[^\r\n]*\*\/\}/u);
  if (!closingMarker || closingMarker.index === undefined) {
    throw new Error('No se encontró el final de la sección actual de sucursales.');
  }
  const end = start + closingMarker.index;
  const locationSection = `{ubicacion && direccionCompleta ? (
        <section
          className={contenedor}
          style={{ ...anchoEstilo, paddingBlock: 'var(--tema-ritmo)' }}
        >
          <p className="etiqueta" style={{ color: 'var(--tema-primario)' }}>
            Dónde estamos
          </p>
          <h2 className="mt-3 font-[family-name:var(--tema-fuente-titulos)] text-4xl">
            Visítanos
          </h2>

          <div className="mt-10 grid overflow-hidden border lg:grid-cols-[0.75fr_1.25fr]"
            style={{
              borderColor: 'var(--tema-borde)',
              background: 'var(--tema-superficie)',
              borderRadius: 'var(--tema-radio)',
            }}
          >
            <div className="flex flex-col justify-center p-7 sm:p-9">
              <MapPin
                className="size-6"
                style={{ color: 'var(--tema-primario)' }}
                aria-hidden="true"
              />
              <h3 className="mt-5 font-[family-name:var(--tema-fuente-titulos)] text-2xl">
                Ubicación
              </h3>
              <p className="mt-3 leading-relaxed" style={{ color: 'var(--tema-texto-suave)' }}>
                {direccionCompleta}
              </p>
              <Boton comoHijo variante="acento" className="mt-6 w-fit">
                <a href={urlComoLlegar} target="_blank" rel="noreferrer">
                  Cómo llegar <ArrowRight className="size-4" />
                </a>
              </Boton>
            </div>

            <iframe
              title={\`Mapa de \${org.nombreComercial}\`}
              src={urlMapa}
              className="min-h-80 w-full border-0"
              loading="lazy"
              allowFullScreen
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </section>
      ) : null}

      `;
  return text.slice(0, start) + locationSection + text.slice(end);
}

function contactPage() {
  return `import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Mail, MapPin, MessageCircle, Navigation } from 'lucide-react';
import { Boton } from '@/components/ui/boton';
import { organizacionPorSlug, sucursalesDeOrganizacion } from '@/lib/tenant/resolver';

export const metadata: Metadata = { title: 'Contacto' };

export default async function Contacto({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const org = await organizacionPorSlug(slug);
  if (!org) notFound();

  const ubicacion = (await sucursalesDeOrganizacion(org.id))[0];
  const direccionCompleta = ubicacion
    ? [ubicacion.direccionCorta, ubicacion.ciudad].filter(Boolean).join(', ')
    : '';
  const consultaMapa = encodeURIComponent(direccionCompleta);
  const urlMapa = direccionCompleta
    ? \`https://www.google.com/maps?q=\${consultaMapa}&output=embed\`
    : '';
  const urlComoLlegar = direccionCompleta
    ? \`https://www.google.com/maps/search/?api=1&query=\${consultaMapa}\`
    : '';
  const wa = org.telefonoWhatsapp
    ? \`https://wa.me/\${org.telefonoWhatsapp.replace(/\\D/g, '')}\`
    : null;

  return (
    <div className="mx-auto w-full px-5 py-16" style={{ maxWidth: 'var(--tema-ancho)' }}>
      <p className="etiqueta" style={{ color: 'var(--tema-primario)' }}>
        Contacto
      </p>
      <h1 className="mt-3 font-[family-name:var(--tema-fuente-titulos)] text-5xl">
        Estamos cerca
      </h1>

      {ubicacion && direccionCompleta ? (
        <div className="mt-10 grid overflow-hidden border md:grid-cols-[0.8fr_1.2fr]"
          style={{
            borderColor: 'var(--tema-borde)',
            background: 'var(--tema-superficie)',
            borderRadius: 'var(--tema-radio)',
          }}
        >
          <article className="flex flex-col justify-center p-6 sm:p-8">
            <MapPin className="size-5" style={{ color: 'var(--tema-primario)' }} />
            <h2 className="mt-4 font-[family-name:var(--tema-fuente-titulos)] text-3xl">
              Ubicación
            </h2>
            <p className="mt-3 leading-relaxed" style={{ color: 'var(--tema-texto-suave)' }}>
              {direccionCompleta}
            </p>
            <Boton comoHijo variante="acento" className="mt-6 w-fit">
              <a href={urlComoLlegar} target="_blank" rel="noreferrer">
                <Navigation className="size-4" /> Cómo llegar
              </a>
            </Boton>
          </article>

          <iframe
            title={\`Mapa de \${org.nombreComercial}\`}
            src={urlMapa}
            className="min-h-80 w-full border-0"
            loading="lazy"
            allowFullScreen
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      ) : null}

      <div className="mt-8 flex flex-wrap gap-3">
        {wa ? (
          <Boton comoHijo variante="acento">
            <a href={wa} target="_blank" rel="noreferrer">
              <MessageCircle className="size-4" /> Escribir por WhatsApp
            </a>
          </Boton>
        ) : null}
        {org.correoContacto ? (
          <Boton comoHijo variante="contorno">
            <a href={\`mailto:\${org.correoContacto}\`}>
              <Mail className="size-4" /> {org.correoContacto}
            </a>
          </Boton>
        ) : null}
      </div>
    </div>
  );
}
`;
}

async function main() {
  const absolute = Object.fromEntries(
    Object.entries(files).map(([key, relative]) => [key, path.join(root, relative)])
  );

  for (const [key, file] of Object.entries(absolute)) {
    try {
      await fs.access(file);
    } catch {
      throw new Error(`No se encontró ${files[key]}. Ejecuta este instalador desde APP_BARBERIA.`);
    }
  }

  const current = Object.fromEntries(
    await Promise.all(
      Object.entries(absolute).map(async ([key, file]) => [key, await fs.readFile(file, 'utf8')])
    )
  );

  if (
    current.editor.includes('type UbicacionInicialEditor') &&
    current.publicHome.includes('const urlComoLlegar =')
  ) {
    console.log('La actualización de ubicación ya está instalada. No se hicieron cambios.');
    return;
  }

  // Prepara todo en memoria. Si algún bloque no coincide, no toca el proyecto.
  const updated = {
    editor: patchEditor(current.editor),
    panelPage: patchPanelPage(current.panelPage),
    actions: patchActions(current.actions),
    publicHome: patchPublicHome(current.publicHome),
    contact: contactPage(),
  };

  const stamp = new Date().toISOString().replace(/[:.]/gu, '-');
  const backupRoot = path.join(root, `respaldo-antes-ubicacion-${stamp}`);
  for (const [key, file] of Object.entries(absolute)) {
    const backup = path.join(backupRoot, files[key]);
    await fs.mkdir(path.dirname(backup), { recursive: true });
    await fs.copyFile(file, backup);
  }

  for (const [key, file] of Object.entries(absolute)) {
    await fs.writeFile(file, updated[key], 'utf8');
  }

  console.log('');
  console.log('Actualización instalada correctamente.');
  console.log(`Respaldo creado en: ${path.relative(root, backupRoot)}`);
  console.log('');
  console.log('Siguiente paso: ejecuta pnpm dev y entra a Apariencia > Ubicación.');
}

main().catch((error) => {
  console.error('');
  console.error(`No se aplicaron los cambios: ${error.message}`);
  console.error('Tu proyecto permanece sin modificaciones.');
  process.exitCode = 1;
});

