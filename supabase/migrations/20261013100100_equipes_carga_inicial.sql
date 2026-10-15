-- =====================================================================
-- Warefly · Carga inicial das equipes
-- Gerada da planilha "Atualização PO x ZEUS" (aba META ATUALIZADA) em 13/10/2026.
-- Colunas: zeus, descrição, supervisor (chave do grupo), integrantes, frota.
-- Linhas sem supervisor, sem integrantes/frota ou marcadas "Não lançar"
-- entram inativas. O Zeus 21435 aparece repetido na planilha e entra uma vez.
-- Depois desta carga, as atualizações vêm pela importação da planilha.
-- =====================================================================

insert into public.equipes (codigo_zeus, nome, grupo_id, integrantes, frota, ativa)
select v.zeus, v.nome, g.id, v.integrantes, v.frota, v.ativa
  from (values
    (21402, 'HEBIO/ONOFRE', 'Pedro', 'Onofre/Hebio', '4791', true),
    (21413, 'GILMAR/JOAO PAULO M', 'Pedro', 'Marcelo Lopes/Andre vitor', '9738', true),
    (21415, 'DOUGLAIR/IVANMAR', 'Pedro', 'ivanma/ rafael correa/douglair', '2266', true),
    (21423, 'FILIPE MOURA/GILBERTO 9325', 'Pedro', 'Gilberto/Rodrigo', '9325', true),
    (21424, 'RODOLFO/FABRICIO DE P', 'Pedro', 'Fabrici jose/ paulo paquiel - Não lançar', '9475', false),
    (21425, 'JUAREZ/JOSIMAR 9500', 'Pedro', 'Luis Lima/Adail Brandao/rogerio', '9500', true),
    (21435, 'EDMILSON JOSE', 'Pedro', 'Edmilson Gois', '5331', true),
    (21441, 'DIEGO/VITOR/FABRICIO 4X2 4404', 'Pedro', 'pedro de araujo/geraldo martins', '4404', true),
    (21445, 'MATHEUS R/JOSUE', 'Pedro', 'Gilberto/patrick soares/ matheus thiago', '8592', true),
    (21446, 'CELIO/ANTONIO', 'Pedro', 'Antonio Marcos/ carlos roberto/celio vitor', '9570', true),
    (21447, 'DOUGLAIR/JOSIMAR/IVANMAR 4X2', 'Pedro', 'erivelton/wesley levy', '9553', true),
    (21454, 'JOSIMAR /LEOMIR/OZIEL 4X2 4252', 'Pedro', 'Ricardo Jose/Leomir Lucas/Oziel', '4252', true),
    (21460, 'THIAGO/LUIS H', 'Pedro', 'Josimar Antonio/thiago jean', '9380', true),
    (21470, 'GIORDAN/JAKSON/EUDES 4X2 4565', 'Pedro', 'Edson Rocha Pascoal/nelio/Jackson antunes', '4565', true),
    (21471, 'ROMARIO/BRUNO 4593', 'Pedro', 'Romario/ josimar garilbade', '4593', true),
    (21474, 'FABRICIO F/FABRI/GILBERTO 4X2', 'Pedro', 'Josue/Giordano Bruno/antonio claudio', '4399', true),
    (21475, 'PMG JULIO/MATHEUS/GUSTAV 6X3', 'Pedro', 'PMG - Gustavo./Victor A Soares/Leandro Theodoro', '9641', true),
    (21483, 'SAMULE JOSE/DIOGO', 'Pedro', 'Sergio vitor/Vinicius manoel', '5336', true),
    (21485, 'SIDNEY/JUNIO', 'Pedro', 'SYDNEY/ JASON', '9477', true),
    (21611, 'JOSE VICENT/WESLEY/GLEISO 4X2 8180', 'Pedro', 'Jose Vicente/fabricio jose/regis pereira', '8180', true),
    (21613, 'Vinícius Rosa / Geraldo', 'Pedro', 'Vinicius rosa/ gleison', '6366', true),
    (21629, 'MARCELO/LUCAS LAERTE 8378', 'Pedro', 'Samuel Jose/helio', '8378', true),
    (21631, 'SAMUEL/ANDRE VITOR', 'Pedro', 'Samuel Valim/ Beglon', '4822', true),
    (21644, 'PMG ERIVELTON/KEMUEL', 'Pedro', 'PMG Alvarenga Kemuel/ Vinicius ragel/Marcones Rafael', '7814', true),
    (21654, 'VINICIUS/GUSTAVO', 'Pedro', 'nathineil mossine /paulo paquiel', '5330', true),
    (21659, 'GILMAR P/PAULO P', 'Pedro', 'Gilmar pereira/ junior / lucas laerte', '5266', true),
    (21686, 'Bruno Oliveira / João Paulo', 'Pedro', 'João Paulo/ bruno de oliveira', '5331', true),
    (21406, 'THIAGO/GUILERME G 8702', 'Vinicius', 'Willians Antunes/gabriel melo', '8702', true),
    (21407, 'AMARILDO/HELINADO 4174', 'Vinicius', 'Amarildo/luis henrique jacinto', '4174', true),
    (21408, 'ROBETOR C/MAXUEL FERNANDES 9250', 'Vinicius', 'Roberto Carlos/ thiago eduardo', '9250', true),
    (21409, 'ROBERTO C/LUIS NOBERTO 4053', 'Vinicius', 'Gedyelson Martins/Thiago da Silva', '4053', true),
    (21417, 'MARCIO/IVO/WILIANS 4X2', 'Vinicius', 'Ivo Bravim/Rafael barbosa', '8176', true),
    (21448, 'PMG VITOR/ANDRE/JHONATAS 4X2 4052', 'Vinicius', 'PMG Aimores luiz carlos/igor rittely', '4052', true),
    (21449, 'ELIAS CLMEN/MARCELO F 4075', 'Vinicius', 'etyeny/Eder Costa', '4075', true),
    (21455, 'MAXUEL F/HARLEY IL 4476', 'Vinicius', 'Conselheiro Pena - Maxuel ferreira/João Vitor Rocha/ matheus henrique ribeiro', '4476', true),
    (21645, 'VICTOR CARVALHIDO/THIAGO 7813', 'Vinicius', 'Vitor Carvalido/ helinaldo kennedd', '7813', true),
    (21656, 'PMG PAULO VICE/LUIS HEN', 'Vinicius', 'PMG Marcelo Ricardo/Vitor cesar/marcio barcelos', '5335', true),
    (21658, 'ROBERTO ROSIL/MAXUEL FERN 7924', 'Vinicius', 'Harley Ilidio/Guilherme Henrique/ ian dias', '7924', true),
    (21687, 'Elias / Matheus Henrique', 'Vinicius', 'Elias Clemente/ guilherme gomes', '8272', true),
    (21457, 'MARCO ANTONIO/LUIZ ALME', 'Victor', 'Alcio Fabio Alves /flavio marques/fernando', '4256', true),
    (21458, 'PMG MENDERS/INDER/CLEIBER 4X2 2131', 'Victor', 'PMG Itabirinha Cleiber/Edvaldo N Viana/Inder', '2131', true),
    (21657, 'MENDERSON/LUIZ HEN/FLAVIO 7812', 'Victor', 'Kleberson/Menderson/ luis almeida', '7812', true),
    (21673, 'EZEQUIAS/FELIPE 4325', 'Victor', 'Felipe Carlos/Walter Peixto', '4325', true),
    (21674, 'LUCIANO/JUNIO BAS', 'Victor', 'Maxuel fernades / yan silva.', '4333', true),
    (21676, 'JUNIOR BASILIO/ANDRE SE', 'Victor', 'junior/ jose lucas/ italo', '9287', true),
    (21679, 'SAMUEL H/GUILHERME', 'Victor', 'Diego Geraldo/otavio augusto', '4621', true),
    (21680, 'SAMUEL H/MARCOS REIS', 'Victor', 'Samuel Henrique/Marcos dos Reis', '4458', true),
    (21681, 'PMG PEDRO/WARLEY/RONALD', 'Victor', 'PMG Safira Pedro Costa/Ronald Perpetuo/Kevin', '4566', true),
    (21682, 'WALISON/MARCOS VINICIUS', 'Victor', 'Walison Junior/Wigney', '4803', true),
    (21401, 'DEVANILDO/MARLON/JOAO PAU 4X2 9693', 'Elton', 'Joao Paulo dos Santos/Devanildo/Marlon Soares', '9693', true),
    (21410, 'LEONE/HENRIQUE FEL', 'Elton', 'Leone/sebastião', '2264', true),
    (21411, 'ALISON AUDRIC/BRENO ROCHA', 'Elton', 'Henrique felix/Hebert Felix', '4377', true),
    (21412, 'CARLOS A/FELIPE GON', 'Elton', 'Carlos Aparecido/Claudemir Alves/Felipe Gonçalves', '4733', true),
    (21418, 'CLERIO/PATRICK', 'Elton', 'Clerio Gonçalves/Patrick Nascimento', '9721', true),
    (21419, 'GLEISSON/GERALDO EDUARDO 9642', 'Elton', 'Gleisson Fernandes/Odilon Alves/ Geraldo Eduardo', '9642', true),
    (21420, 'JAMES/CLERIO', 'Elton', 'Adailton Candid / breno rocha', '4061', true),
    (21422, 'DANILO/ROBERTH 9735', 'Elton', 'Danilo Eloi/Edvaldo Jose/Robert', '9735', true),
    (21450, 'LINDOMAR/BRUNO/JAMES 4X2', 'Elton', 'Lindomar Lopes/ivan lemes', '4523', true),
    (21451, 'DIEGO/MAGNO/JOSE V 4X2', 'Elton', 'Guilherme Anastacio/Magno Raimundo/jose valois', '4050', true),
    (21453, 'MARCO/GERALDO/JEFERSON 4X2 4627', 'Elton', 'Jefferson Oliveira/Geraldo Lafaiete/marco vinicius', '4627', true),
    (21459, 'GEOVANE/EDGAR/JOSIANE 4X2 4520', 'Elton', 'Geovane Monteiro/Edgar Coelho/ josiane', '4520', true),
    (21612, 'WEBERT/HEBERT FE 4268', 'Elton', 'Handerson Leonardo/Webert Cardoso/Ivan Messias', '4268', true),
    (21646, 'PMG JAMES/JOAO PA/IVAN LE 4X2 7811', 'Elton', 'PMG Agua Boa Joao Paulo Soares/Antonio Alberto/James', '7811', true),
    (21426, 'FRAMPTON', 'Kesia', 'Frampton de Souza Braga', '9660', true),
    (21429, 'CLAUDIO DA SILVA', 'Kesia', 'Claudio da Silva Lopes', '4869', true),
    (21434, 'MAURO FERREIRA', 'Kesia', 'Mauro Ferreira da Silva', '8795', true),
    (21436, 'JOEL SILVA', 'Kesia', 'Joel Silva', '8896', true),
    (21438, 'DIOGO ROSA', 'Kesia', 'Diogo Rosa', '4047', true),
    (21487, 'MARCELO SOARES', 'Kesia', 'Marcelo Soares de Oliveira', '3882', true),
    (21601, 'ANDRE LUIZ RODRIGUES', 'Kesia', 'Andre Luiz Rodrigues Cunha-ferias', '2301', true),
    (21617, 'EMERSON ALVES', 'Kesia', 'Emerson Alves de Barros', '2313', true),
    (21622, 'PEDRO HENRIQUE CHAGAS', 'Kesia', 'Pedro Henrique Chagas', '4729', true),
    (21624, 'IZAQUEU ILIDIO', 'Kesia', 'Izaquel Ilidio', '4748', true),
    (21625, 'ANDRE SOARES', 'Kesia', 'Andre Soares', '9608', true),
    (21632, 'JUNIO COELHO DOS REIS', 'Kesia', 'Junio Coelho dos Reis', '2299', true),
    (21633, 'PEDRO ALVES BATISTA', 'Kesia', 'Pedro Alves Batista', '2289', true),
    (21638, 'RENATO JESUS B S NASCIMENTO', 'Kesia', 'Renato Jesus de Souza Nascimento', '8667', true),
    (21641, 'MATHEUS NUNES SILVA', 'Kesia', 'Matheus Nunes Silva', '2307', true),
    (21647, 'JOSEPH WILLIAM ALVES', 'Kesia', 'Joseph William', '2075', true),
    (21649, 'ELIEZER DOS SANTOS CHAVES', 'Kesia', 'Eliezer dos Santos', '2314', true),
    (21650, 'WENDEL RAMOS DA LUZ', 'Kesia', 'Wendel Ramos', '2321', true),
    (21652, 'DIEGO FARIA DOS SANTOS', 'Kesia', 'Diego Faria', '4898', true),
    (21653, 'PAULO CESAR MEDINA', 'Kesia', 'Paulo Cesar Medina', '7794', true),
    (21660, 'CALEBE THAILEFER', 'Kesia', 'Calebe Thailefer', '9522', true),
    (21664, 'GECIMAR RAMOS', 'Kesia', 'Gecimar Ramos', '8607', true),
    (21665, 'LEANDRO HENRIQUE', 'Kesia', 'Leandro Henrique', '2287', true),
    (21666, 'MARCO ANTONIO ALVES FER', 'Kesia', 'Marco Antonio Alves Ferreira', '4946', true),
    (21667, 'ANDRE FILIP SILVA ANDRA', 'Kesia', 'Andre Filip Silva de Andrade', '2308', true),
    (21668, 'DAVID S DUARTE MARTINS', 'Kesia', 'David Schyneyder Duarte Martins', '2290', true),
    (21669, 'SERGIO LUIZ G JUNIOR', 'Kesia', 'Sergio Luiz Gonçalves Junior', '4047', true),
    (21671, 'MATHEUS ALVES SILVA', 'Kesia', 'Matheus Alves Silva', '4506', true),
    (21672, 'CLINGER O DA SILVA', 'Kesia', 'Clinger Oliveira da Silva', '2320', true),
    (21142, 'SOBREAVISO CEMIG', null, null, null, false),
    (21619, 'VALKIRIA DIONISIA', null, null, null, false)
  ) as v (zeus, nome, supervisor, integrantes, frota, ativa)
  left join public.grupos g on lower(g.chave_planilha) = lower(v.supervisor);

-- Locais liberados: os do grupo de cada equipe
insert into public.equipe_locais (equipe_id, almox_id)
select e.id, gl.almox_id
  from public.equipes e
  join public.grupo_locais gl on gl.grupo_id = e.grupo_id
 where e.codigo_zeus is not null
on conflict do nothing;
