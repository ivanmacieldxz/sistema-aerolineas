# Diccionario de Datos del Sistema de Aerolínea

Este documento detalla las entidades que componen la base de datos relacional del sistema de gestión de la aerolínea (definidas en [diagrama_relacional.mmd](diagrama_relacional.mmd)), especificando para cada una su propósito, campos, tipos de datos y restricciones de integridad (entidad, referencial, dominio y reglas de negocio derivadas del Enunciado 2).

---

## 1. Convenciones y Simbología

- **PK**: Clave Primaria (*Primary Key*). Identifica unívocamente a cada registro en la tabla.
- **FK**: Clave Foránea (*Foreign Key*). Establece integridad referencial con otra tabla.
- **UK**: Clave Única (*Unique Key*). Garantiza que el valor no se repita en la tabla.
- **NN**: No Nulo (*Not Null*). Campo obligatorio.
- **NULL**: Campo opcional / nullable.

---

## 2. Mapa de Relaciones e Integridad Referencial

| Entidad Origen | Cardinalidad | Entidad Destino | Campo FK Origen | Campo PK Destino | Descripción de la Relación |
| :--- | :---: | :--- | :--- | :--- | :--- |
| `USUARIO` | N : 1 | `ROL` | `role_id` | `ROL(id)` | Todo usuario posee asignado un rol específico. |
| `TRANSACCION_COMPRA` | N : 0..1 | `USUARIO` | `usuario_id` | `USUARIO(id)` | Compra realizada por usuario registrado o invitado. |
| `VUELO` | N : 1 | `AEROPUERTO` | `origen_iata` | `AEROPUERTO(iata_code)` | Aeropuerto de salida de la ruta. |
| `VUELO` | N : 1 | `AEROPUERTO` | `destino_iata` | `AEROPUERTO(iata_code)` | Aeropuerto de llegada de la ruta. |
| `VUELO_DIA_SEMANA` | N : 1 | `VUELO` | `vuelo_id` | `VUELO(id)` | Días semanales en los que opera el vuelo. |
| `INSTANCIA_VUELO` | N : 1 | `VUELO` | `vuelo_id` | `VUELO(id)` | Vuelo concreto programado en una fecha calendario. |
| `PAGO` | 1 : 1 | `TRANSACCION_COMPRA`| `transaccion_id`| `TRANSACCION_COMPRA(id)` | Registro de pago único asociado a la compra. |
| `FACTURA` | 1 : 1 | `TRANSACCION_COMPRA`| `transaccion_id`| `TRANSACCION_COMPRA(id)` | Comprobante fiscal emitido por compra. |
| `PASAJE` | N : 1 | `TRANSACCION_COMPRA`| `transaccion_id`| `TRANSACCION_COMPRA(id)` | Pasajes emitidos en la orden (máximo 9). |
| `PASAJE` | N : 1 | `INSTANCIA_VUELO` | `instancia_vuelo_id` | `INSTANCIA_VUELO(id)` | Ocupación de plaza en un vuelo específico. |

---

## 3. Especificación de Entidades

### 3.1. ROL
> Define los perfiles y niveles de acceso al sistema.

#### Campos y Tipos de Datos
| Campo | Tipo de Dato | Clave | Nulabilidad | Valor por Defecto | Descripción |
| :--- | :--- | :---: | :---: | :--- | :--- |
| `id` | `INT` | PK | NN | Autoincremental | Identificador numérico único del rol. |
| `nombre` | `VARCHAR(50)` | UK | NN | N/A | Nombre identificador del perfil (ej. `ADMINISTRADOR`, `EMPLEADO_MOSTRADOR`, `PASAJERO`). |
| `deleted` | `BOOLEAN` | - | NN | `FALSE` | Indicador de baja lógica del registro. |

#### Restricciones de Integridad
- **Integridad de Entidad:** `PK (id)`.
- **Integridad de Unicidad:** `UK (nombre) WHERE deleted = FALSE` (índice único condicional sobre registros activos).
- **Integridad Referencial:** Solo roles con `deleted = FALSE` pueden ser asignados a un `USUARIO`. Se restringe la baja lógica de un rol si existen usuarios activos asociados.
- **Integridad de Dominio:** `deleted` es de tipo `BOOLEAN NOT NULL DEFAULT FALSE`. `nombre` no vacío, valores controlados según los perfiles de usuario especificados en el requerimiento.

---

### 3.2. USUARIO
> Almacena la información de los usuarios del sistema.

#### Campos y Tipos de Datos
| Campo | Tipo de Dato | Clave | Nulabilidad | Valor por Defecto | Descripción |
| :--- | :--- | :---: | :---: | :--- | :--- |
| `id` | `BIGINT` | PK | NN | Autoincremental | Identificador numérico único del usuario en el sistema. |
| `role_id` | `INT` | FK | NN | N/A | Identificador del rol asignado. Referencia a `ROL(id)`. |
| `name` | `VARCHAR(100)` | - | NN | N/A | Nombre del usuario. |
| `apellido` | `VARCHAR(100)` | - | NN | N/A | Apellido del usuario. |
| `email` | `VARCHAR(255)` | UK | NN | N/A | Correo electrónico principal del usuario para acceso y notificaciones. |
| `clerk_id` | `VARCHAR(255)` | UK | NN | N/A | Identificador único provisto por el proveedor de autenticación Clerk. |
| `deleted` | `BOOLEAN` | - | NN | `FALSE` | Indicador de baja lógica del registro. |

#### Restricciones de Integridad
- **Integridad de Entidad:** `PK (id)`.
- **Integridad Referencial:** `FK (role_id) REFERENCES ROL(id) ON DELETE RESTRICT ON UPDATE CASCADE`. Solo se permite asociar roles con `deleted = FALSE`.
- **Integridad de Unicidad:** `UK (clerk_id) WHERE deleted = FALSE` y `UK (email) WHERE deleted = FALSE` (índices únicos condicionales sobre usuarios activos).
- **Integridad de Dominio:** `deleted` es de tipo `BOOLEAN NOT NULL DEFAULT FALSE`. `email` debe respetar una estructura de correo electrónico válida; `name` y `apellido` deben contener cadenas no vacías.
- **Regla de Negocio:** Un usuario con `deleted = TRUE` queda inhabilitado para autenticarse o iniciar nuevas transacciones de compra.

---

### 3.3. AEROPUERTO
> Representa los aeropuertos habilitados para operar como terminales de origen o destino en los vuelos de la aerolínea.

#### Campos y Tipos de Datos
| Campo | Tipo de Dato | Clave | Nulabilidad | Valor por Defecto | Descripción |
| :--- | :--- | :---: | :---: | :--- | :--- |
| `iata_code` | `CHAR(3)` | PK | NN | N/A | Código IATA de 3 letras mayúsculas de la terminal (ej. `AEP`, `EZE`, `COR`). |
| `nombre` | `VARCHAR(150)` | - | NN | N/A | Nombre oficial del aeropuerto (ej. "Aeroparque Jorge Newbery"). |
| `ciudad` | `VARCHAR(100)` | - | NN | N/A | Ciudad donde está radicado el aeropuerto. |
| `provincia` | `VARCHAR(100)` | - | NN | N/A | Provincia donde se ubica el aeropuerto. |

#### Restricciones de Integridad
- **Integridad de Entidad:** `PK (iata_code)`.
- **Integridad de Dominio:** `CHECK (iata_code ~ '^[A-Z]{3}$')` (exactamente 3 caracteres alfabéticos en mayúscula). Campos de texto no vacíos.

---

### 3.4. VUELO
> Modela la programación regular de un vuelo creada por los administradores, definiendo aeropuertos de origen/destino, horarios de salida/llegada, vigencia anual, capacidad por clase y precios.

#### Campos y Tipos de Datos
| Campo | Tipo de Dato | Clave | Nulabilidad | Valor por Defecto | Descripción |
| :--- | :--- | :---: | :---: | :--- | :--- |
| `id` | `BIGINT` | PK | NN | Autoincremental | Identificador único del vuelo programado. |
| `numero_vuelo` | `VARCHAR(20)` | UK | NN | N/A | Código alfanumérico identificador comercial del vuelo (ej. "AR1400"). |
| `origen_iata` | `CHAR(3)` | FK | NN | N/A | Código IATA del aeropuerto de origen. Referencia a `AEROPUERTO(iata_code)`. |
| `destino_iata` | `CHAR(3)` | FK | NN | N/A | Código IATA del aeropuerto de destino. Referencia a `AEROPUERTO(iata_code)`. |
| `hora_salida` | `TIME` | - | NN | N/A | Hora programada de partida (HH:MM:SS). |
| `hora_llegada` | `TIME` | - | NN | N/A | Hora estimada de arribo (HH:MM:SS). |
| `vigencia_desde`| `DATE` | - | NN | N/A | Fecha de inicio del periodo del año en que el vuelo está a la venta. |
| `vigencia_hasta`| `DATE` | - | NN | N/A | Fecha de finalización del periodo del año para la venta del vuelo. |
| `capacidad_economy`| `INT` | - | NN | N/A | Cantidad total de asientos configurados para clase Economy. |
| `capacidad_primera`| `INT` | - | NN | N/A | Cantidad total de asientos configurados para Primera Clase. |
| `precio_economy`| `DECIMAL(12,2)` | - | NN | N/A | Tarifa base por pasaje en clase Economy. |
| `precio_primera`| `DECIMAL(12,2)` | - | NN | N/A | Tarifa base por pasaje en Primera Clase. |
| `activo` | `BOOLEAN` | - | NN | `TRUE` | Indicador de disponibilidad operativa para comercialización. |
| `deleted` | `BOOLEAN` | - | NN | `FALSE` | Indicador de baja lógica del registro. |

#### Restricciones de Integridad
- **Integridad de Entidad:** `PK (id)`.
- **Integridad Referencial:**
  - `FK (origen_iata) REFERENCES AEROPUERTO(iata_code) ON DELETE RESTRICT`.
  - `FK (destino_iata) REFERENCES AEROPUERTO(iata_code) ON DELETE RESTRICT`.
  - La baja lógica de un vuelo (`deleted = TRUE`) se restringe si existen instancias futuras con pasajes emitidos activos.
- **Integridad de Unicidad:** `UK (numero_vuelo) WHERE deleted = FALSE` (índice único condicional sobre vuelos activos).
- **Integridad de Dominio / Verificación (CHECK):**
  - `deleted` es de tipo `BOOLEAN NOT NULL DEFAULT FALSE`.
  - Si `deleted = TRUE`, la ruta queda inhabilitada para generar nuevas instancias y para comercialización (`activo = FALSE`).
  - `CHECK (origen_iata <> destino_iata)`: El aeropuerto de origen debe ser distinto al aeropuerto de destino.
  - `CHECK (vigencia_hasta >= vigencia_desde)`: El rango de vigencia anual debe ser coherente.
  - `CHECK (capacidad_economy >= 0 AND capacidad_primera >= 0)`: Las capacidades no pueden ser negativas.
  - `CHECK ((capacidad_economy + capacidad_primera) > 0)`: El avión debe disponer de al menos un asiento habilitado para la venta.
  - `CHECK (precio_economy > 0.00 AND precio_primera > 0.00)`: Las tarifas por clase deben ser montos positivos.

---

### 3.5. VUELO_DIA_SEMANA
> Entidad asociativa que especifica los días de la semana en los cuales opera un vuelo determinado.

#### Campos y Tipos de Datos
| Campo | Tipo de Dato | Clave | Nulabilidad | Valor por Defecto | Descripción |
| :--- | :--- | :---: | :---: | :--- | :--- |
| `vuelo_id` | `BIGINT` | PK, FK | NN | N/A | Identificador del vuelo asociado. Referencia a `VUELO(id)`. |
| `dia_semana` | `SMALLINT` | PK | NN | N/A | Día de la semana en que opera el vuelo (1 = Lunes .. 7 = Domingo). |

#### Restricciones de Integridad
- **Integridad de Entidad:** `PK (vuelo_id, dia_semana)` (clave primaria compuesta).
- **Integridad Referencial:** `FK (vuelo_id) REFERENCES VUELO(id) ON DELETE CASCADE ON UPDATE CASCADE`. Solo se asignan días operativos a rutas de vuelo activas (`deleted = FALSE`).
- **Integridad de Dominio:** `CHECK (dia_semana BETWEEN 1 AND 7)` siguiendo la convención estándar (1=Lunes a 7=Domingo).

---

### 3.6. INSTANCIA_VUELO
> Representa la salida o ejecución real y concreta de un vuelo en una fecha de calendario específica, sobre la cual se controlan la ocupación, demoras y cancelaciones.

#### Campos y Tipos de Datos
| Campo | Tipo de Dato | Clave | Nulabilidad | Valor por Defecto | Descripción |
| :--- | :--- | :---: | :---: | :--- | :--- |
| `id` | `BIGINT` | PK | NN | Autoincremental | Identificador único de la instancia de vuelo. |
| `vuelo_id` | `BIGINT` | FK | NN | N/A | Identificador del vuelo programado base. Referencia a `VUELO(id)`. |
| `fecha_salida`| `DATE` | - | NN | N/A | Fecha de calendario en la que se efectúa el vuelo. |
| `estado` | `VARCHAR(20)` | - | NN | `'PROGRAMADO'` | Estado operativo de la salida concreta. |
| `deleted` | `BOOLEAN` | - | NN | `FALSE` | Indicador de baja lógica del registro. |

#### Restricciones de Integridad
- **Integridad de Entidad:** `PK (id)`.
- **Integridad Referencial:** `FK (vuelo_id) REFERENCES VUELO(id) ON DELETE RESTRICT ON UPDATE CASCADE`. Solo pueden programarse instancias para vuelos con `deleted = FALSE`.
- **Integridad de Unicidad:** `UK (vuelo_id, fecha_salida) WHERE deleted = FALSE` (evita duplicar salidas activas para un mismo vuelo y fecha).
- **Integridad de Dominio:**
  - `deleted` es de tipo `BOOLEAN NOT NULL DEFAULT FALSE`.
  - `CHECK (estado IN ('PROGRAMADO', 'DEMORADO', 'CANCELADO', 'FINALIZADO'))`.
- **Regla de Negocio:** La `fecha_salida` debe encontrarse dentro del rango `[vigencia_desde, vigencia_hasta]` del vuelo y corresponder a un día habilitado en `VUELO_DIA_SEMANA`. Solo las instancias con `deleted = FALSE` participan en la venta de pasajes y cálculo de ocupación.

---

### 3.7. TRANSACCION_COMPRA
> Agrupa y gestiona la operación comercial de compra de hasta 9 pasajes por transacción, permitiendo compras a usuarios registrados o en modalidad invitado.

#### Campos y Tipos de Datos
| Campo | Tipo de Dato | Clave | Nulabilidad | Valor por Defecto | Descripción |
| :--- | :--- | :---: | :---: | :--- | :--- |
| `id` | `BIGINT` | PK | NN | Autoincremental | Identificador numérico de la transacción de compra. |
| `usuario_id` | `BIGINT` | FK | NULL | `NULL` | Usuario registrado que realiza la compra. Permite `NULL` para compra como invitado. Referencia a `USUARIO(id)`. |
| `email_contacto`| `VARCHAR(255)`| - | NN | N/A | Correo electrónico para el envío automático de los tickets electrónicos, factura y alertas. |
| `fecha_creacion`| `TIMESTAMP` | - | NN | `CURRENT_TIMESTAMP` | Fecha y hora en la que se registra la transacción. |
| `estado` | `VARCHAR(20)` | - | NN | `'PENDIENTE'` | Estado comercial de la transacción de compra. |
| `total` | `DECIMAL(12,2)`| - | NN | `0.00` | Monto total acumulado de la compra. |
| `deleted` | `BOOLEAN` | - | NN | `FALSE` | Indicador de baja lógica del registro. |

#### Restricciones de Integridad
- **Integridad de Entidad:** `PK (id)`.
- **Integridad Referencial:**
  - `FK (usuario_id) REFERENCES USUARIO(id) ON DELETE SET NULL ON UPDATE CASCADE`. Solo usuarios con `deleted = FALSE` pueden asociarse a nuevas transacciones.
  - La baja lógica de una transacción (`deleted = TRUE`) está restringida si posee un pago aprobado (`PAGO.estado = 'APROBADO'`) o factura emitida, salvo procedimiento de anulación o reembolso formal.
- **Integridad de Dominio:**
  - `deleted` es de tipo `BOOLEAN NOT NULL DEFAULT FALSE`.
  - `CHECK (estado IN ('PENDIENTE', 'CONFIRMADA', 'RECHAZADA', 'REEMBOLSADA'))`.
  - `CHECK (total >= 0.00)`.
  - `email_contacto` con formato de email válido.
- **Reglas de Negocio (Enunciado 2):**
  - **Límite de pasajes por transacción:** Cada transacción de compra debe contener entre 1 y un máximo de 9 pasajes (`1 <= COUNT(PASAJE) <= 9`).
  - **Coherencia contable:** El `total` debe coincidir con la sumatoria del valor de los pasajes asociados a la transacción.

---

### 3.8. PAGO
> Almacena los datos y el resultado del procesamiento monetario emitido por la pasarela de pagos para saldar una transacción de compra.

#### Campos y Tipos de Datos
| Campo | Tipo de Dato | Clave | Nulabilidad | Valor por Defecto | Descripción |
| :--- | :--- | :---: | :---: | :--- | :--- |
| `id` | `BIGINT` | PK | NN | Autoincremental | Identificador único del registro de pago. |
| `transaccion_id`| `BIGINT` | FK, UK | NN | N/A | Transacción de compra a la que corresponde el cobro. Referencia a `TRANSACCION_COMPRA(id)`. |
| `metodo_pago` | `VARCHAR(30)` | - | NN | N/A | Medio de pago utilizado (ej. `'TARJETA_CREDITO'`, `'TARJETA_DEBITO'`). |
| `id_transaccion_pasarela` | `VARCHAR(100)` | - | NN | N/A | Código de autorización o identificador retornado por la pasarela de pago externa. |
| `monto` | `DECIMAL(12,2)`| - | NN | N/A | Importe efectivamente cobrado. |
| `fecha_pago` | `TIMESTAMP` | - | NN | `CURRENT_TIMESTAMP` | Fecha y hora en que se procesó el pago. |
| `estado` | `VARCHAR(20)` | - | NN | `'PENDIENTE'` | Estado del resultado de la operación de cobro. |

#### Restricciones de Integridad
- **Integridad de Entidad:** `PK (id)`.
- **Integridad Referencial:** `FK (transaccion_id) REFERENCES TRANSACCION_COMPRA(id) ON DELETE RESTRICT ON UPDATE CASCADE`. Solo se registran pagos sobre transacciones activas (`deleted = FALSE`).
- **Integridad de Unicidad:** `UK (transaccion_id)` que garantiza la relación estricta 1 a 1 con la orden de compra.
- **Integridad de Dominio:**
  - `CHECK (estado IN ('APROBADO', 'RECHAZADO', 'PENDIENTE'))`.
  - `CHECK (monto > 0.00)`.
  - `CHECK (metodo_pago IN ('TARJETA_CREDITO', 'TARJETA_DEBITO', 'TRANSFERENCIA', 'OTRO'))`.
- **Regla de Negocio:** El `monto` cobrado con estado `'APROBADO'` debe ser idéntico al `total` registrado en la `TRANSACCION_COMPRA`.

---

### 3.9. FACTURA
> Comprobante tributario y legal emitido automáticamente una vez aprobado el pago de la compra para su posterior remisión al comprador.

#### Campos y Tipos de Datos
| Campo | Tipo de Dato | Clave | Nulabilidad | Valor por Defecto | Descripción |
| :--- | :--- | :---: | :---: | :--- | :--- |
| `id` | `BIGINT` | PK | NN | Autoincremental | Identificador único de la factura en el sistema. |
| `transaccion_id`| `BIGINT` | FK, UK | NN | N/A | Transacción que origina la factura. Referencia a `TRANSACCION_COMPRA(id)`. |
| `numero_factura`| `VARCHAR(50)` | UK | NN | N/A | Numeración legal única y correlativa del comprobante (ej. "FC-B-0001-00012345"). |
| `tipo_factura` | `VARCHAR(10)` | - | NN | N/A | Letra o clase de comprobante fiscal emitido (ej. `'A'`, `'B'`, `'C'`). |
| `nombre_razon_social` | `VARCHAR(150)`| - | NN | N/A | Razón social o nombre y apellido del receptor de la factura. |
| `identificacion_fiscal`| `VARCHAR(30)` | - | NN | N/A | Identificación tributaria (CUIT, CUIL o DNI del adquirente). |
| `total` | `DECIMAL(12,2)`| - | NN | N/A | Importe total facturado. |
| `fecha_emision` | `TIMESTAMP` | - | NN | `CURRENT_TIMESTAMP` | Fecha y hora formal de emisión de la factura. |

#### Restricciones de Integridad
- **Integridad de Entidad:** `PK (id)`.
- **Integridad Referencial:** `FK (transaccion_id) REFERENCES TRANSACCION_COMPRA(id) ON DELETE RESTRICT ON UPDATE CASCADE`. Solo se emite factura para transacciones con `deleted = FALSE`.
- **Integridad de Unicidad:**
  - `UK (transaccion_id)` para asegurar exactamente una factura por cada transacción de compra (relación 1:1).
  - `UK (numero_factura)` para evitar duplicidad de números fiscales legales.
- **Integridad de Dominio:**
  - `CHECK (total >= 0.00)`.
  - `CHECK (tipo_factura IN ('A', 'B', 'C'))`.
  - Cadenas descriptivas no vacías.

---

### 3.10. PASAJE
> Boleto electrónico emitido a nombre de un pasajero para una clase determinada (Economy o Primera) en una instancia concreta de vuelo, con asignación de asiento y seguimiento de estado.

#### Campos y Tipos de Datos
| Campo | Tipo de Dato | Clave | Nulabilidad | Valor por Defecto | Descripción |
| :--- | :--- | :---: | :---: | :--- | :--- |
| `codigo` | `BIGINT` | PK | NN | Autoincremental | Código identificador único del pasaje / ticket electrónico. |
| `transaccion_id`| `BIGINT` | FK | NN | N/A | Transacción de compra que incluye este billete. Referencia a `TRANSACCION_COMPRA(id)`. |
| `instancia_vuelo_id` | `BIGINT`| FK | NN | N/A | Salida concreta de vuelo para la que se emite el pasaje. Referencia a `INSTANCIA_VUELO(id)`. |
| `clase` | `VARCHAR(20)` | - | NN | N/A | Categoría de cabina seleccionada (`'ECONOMY'` o `'PRIMERA'`). |
| `pasajero_nombre` | `VARCHAR(100)`| - | NN | N/A | Nombre del pasajero titular del ticket. |
| `pasajero_apellido` | `VARCHAR(100)`| - | NN | N/A | Apellido del pasajero titular del ticket. |
| `pasajero_documento`| `VARCHAR(30)` | - | NN | N/A | DNI o documento de identidad del pasajero. |
| `numero_asiento`| `VARCHAR(10)` | - | NULL | `NULL` | Butaca asignada (ej. "04A"), asignable durante la compra o el check-in. |
| `estado` | `VARCHAR(20)` | - | NN | `'EMITIDO'` | Estado actual del billete. |

#### Restricciones de Integridad
- **Integridad de Entidad:** `PK (codigo)`.
- **Integridad Referencial:**
  - `FK (transaccion_id) REFERENCES TRANSACCION_COMPRA(id) ON DELETE RESTRICT ON UPDATE CASCADE`. Solo se permite emitir pasajes vinculados a transacciones activas (`deleted = FALSE`).
  - `FK (instancia_vuelo_id) REFERENCES INSTANCIA_VUELO(id) ON DELETE RESTRICT ON UPDATE CASCADE`. Solo se permite emitir pasajes sobre instancias de vuelo activas (`deleted = FALSE`).
- **Integridad de Unicidad Condicional:**
  - `UK (instancia_vuelo_id, numero_asiento)` para todo `numero_asiento IS NOT NULL`: un mismo asiento físico no puede ser asignado a dos pasajes en la misma instancia de vuelo.
- **Integridad de Dominio:**
  - `CHECK (clase IN ('ECONOMY', 'PRIMERA'))`.
  - `CHECK (estado IN ('EMITIDO', 'CANCELADO', 'CHECK_IN'))`.
- **Reglas de Negocio:**
  - **Límite de capacidad Economy:** Para cada instancia de vuelo activa (`deleted = FALSE`), el total de pasajes en estado `'EMITIDO'` o `'CHECK_IN'` con `clase = 'ECONOMY'` no debe superar la `capacidad_economy` configurada en el `VUELO`.
  - **Límite de capacidad Primera Clase:** Para cada instancia de vuelo activa (`deleted = FALSE`), el total de pasajes en estado `'EMITIDO'` o `'CHECK_IN'` con `clase = 'PRIMERA'` no debe superar la `capacidad_primera` configurada en el `VUELO`.
  - **Cancelación o reprogramación de vuelo:** En caso de que la `INSTANCIA_VUELO` pase a estado `'CANCELADO'`, los pasajes asociados deben actualizar su estado según las políticas de reembolso o notificación por correo a los pasajeros.
