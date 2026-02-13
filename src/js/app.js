    import { getTimezoneOffset, isSwissDST, getDayTypeInTZ, getHourInTZ } from './core/time.js';
    import { getOverlapWindows } from './core/call-windows.js';
    import { selectSceneByHour } from './core/happening.js';
    import { normalizeAiDailyContent, buildAiHappeningOverrides } from './core/ai-daily.js';
    import { shouldRecordMessage, createMessageLogEntry, appendMessageLog } from './core/message-log.js';

    // ===================================================================
    //  MINDELO-LAUSANNE TIME BRIDGE - Main Application Script
    //  with i18n support for EN, FR, PT
    // ===================================================================

    (function() {
        'use strict';

        // ---- Configuration ----
        const MINDELO_TZ = 'Atlantic/Cape_Verde';  // UTC-1 year-round
        const LAUSANNE_TZ = 'Europe/Zurich';        // CET/CEST
        const DEFAULT_AI_ENDPOINT = 'https://mindelo-lausanne-ai-bridge.mindelo-lausanne-ai.workers.dev/api/insight';
        const AI_ENDPOINT = (
            (window.TIME_BRIDGE_CONFIG && window.TIME_BRIDGE_CONFIG.aiEndpoint) ||
            localStorage.getItem('timeBridgeAiEndpoint') ||
            DEFAULT_AI_ENDPOINT ||
            ''
        ).trim();
        const AI_DAILY_CACHE_KEY = 'timeBridgeAiDailyContentV1';
        const MESSAGE_LOG_KEY = 'timeBridgeMessageDisplayLogV1';

        // ---- i18n Translations ----
        let currentLang = localStorage.getItem('timeBridgeLang') || 'en';
        let aiHasGenerated = false;
        let aiDailyContent = null;
        let aiHappeningOverrides = null;
        let aiDailyCache = loadAiDailyCache();
        let messageLog = loadMessageLog();
        let lastDisplayedByCity = { cv: null, ch: null };

        const LOCALES = { en: 'en-GB', fr: 'fr-FR', pt: 'pt-PT' };

        const T = {
            // ---- Header & structure ----
            subtitle:           { en: 'A bridge between two homes', fr: 'Un pont entre deux maisons', pt: 'Uma ponte entre duas casas' },
            timeDiffPrefix:     { en: 'Lausanne is', fr: 'Lausanne a', pt: 'Lausanne está' },
            timeDiffSuffix:     { en: 'ahead of Mindelo', fr: "d'avance sur Mindelo", pt: 'à frente de Mindelo' },
            hour:               { en: 'hour', fr: 'heure', pt: 'hora' },
            hours:              { en: 'hours', fr: 'heures', pt: 'horas' },
            locationCv:         { en: 'Cabo Verde', fr: 'Cabo Verde', pt: 'Cabo Verde' },
            locationCh:         { en: 'Switzerland', fr: 'Suisse', pt: 'Suíça' },

            // ---- Happening labels ----
            happeningLabelCv:   { en: 'Right now in Mindelo', fr: 'En ce moment à Mindelo', pt: 'Neste momento em Mindelo' },
            happeningLabelCh:   { en: 'Right now in Lausanne', fr: 'En ce moment à Lausanne', pt: 'Neste momento em Lausanne' },

            // ---- Best time to call ----
            callTitle:          { en: 'Best Time to Call', fr: 'Meilleur moment pour appeler', pt: 'Melhor horário para ligar' },
            callSubtitle:       { en: 'Best overlap when both cities are awake and off work', fr: "Meilleur chevauchement quand les deux villes sont réveillées et hors travail", pt: 'Melhor sobreposição quando as duas cidades estão acordadas e fora do trabalho' },
            callHoursCvLabel:   { en: '🇨🇻 Mindelo call window', fr: "🇨🇻 Fenêtre d'appel à Mindelo", pt: '🇨🇻 Janela para ligar em Mindelo' },
            callHoursChLabel:   { en: '🇨🇭 Lausanne call window', fr: "🇨🇭 Fenêtre d'appel à Lausanne", pt: '🇨🇭 Janela para ligar em Lausanne' },
            callHoursCvValue:   { en: 'Awake: 08:00-21:00 · Work (Mon-Fri): 08:00-13:00, 14:00-18:00', fr: 'Réveil: 08:00-21:00 · Travail (Lun-Ven): 08:00-13:00, 14:00-18:00', pt: 'Acordado: 08:00-21:00 · Trabalho (Seg-Sex): 08:00-13:00, 14:00-18:00' },
            callHoursChValue:   { en: 'Awake: 08:00-21:00 · Work (Mon-Fri): 09:00-18:00', fr: 'Réveil: 08:00-21:00 · Travail (Lun-Ven): 09:00-18:00', pt: 'Acordado: 08:00-21:00 · Trabalho (Seg-Sex): 09:00-18:00' },
            callStatusNow:      { en: 'Good moment to call now', fr: 'Bon moment pour appeler maintenant', pt: 'Bom momento para ligar agora' },
            callStatusLater:    { en: 'Next overlap window', fr: 'Prochaine fenêtre commune', pt: 'Próxima janela em comum' },
            callStatusNextStarts: { en: 'Next window starts', fr: 'Prochaine fenêtre à partir de', pt: 'Próxima janela começa' },
            callStatusNone:     { en: 'No overlap in the next 7 days', fr: 'Aucun chevauchement dans les 7 prochains jours', pt: 'Sem sobreposição nos próximos 7 dias' },
            callUntil:          { en: 'Until', fr: "Jusqu'à", pt: 'Até' },
            callNoWindow:       { en: 'Check next weekend', fr: 'Vérifiez le week-end prochain', pt: 'Verifique no próximo fim de semana' },
            callWindowPrefix:   { en: 'Lausanne', fr: 'Lausanne', pt: 'Lausanne' },
            callWindowSuffix:   { en: 'Mindelo', fr: 'Mindelo', pt: 'Mindelo' },

            // ---- AI Insight ----
            aiTitle:            { en: 'AI Daily Insight', fr: 'Insight IA du jour', pt: 'Insight diário com IA' },
            aiSubtitle:         { en: 'AI-generated content may contain mistakes.', fr: "Contenu généré par IA, pouvant contenir des erreurs.", pt: 'Conteúdo gerado por IA, pode conter erros.' },
            aiStatusNotConfigured: { en: 'AI backend not configured yet', fr: 'Backend IA non configuré', pt: 'Backend de IA ainda não configurado' },
            aiStatusReady:      { en: 'Daily insight loaded', fr: 'Insight du jour chargé', pt: 'Insight diário carregado' },
            aiStatusLoading:    { en: 'Generating insight...', fr: "Génération de l'insight...", pt: 'A gerar insight...' },
            aiStatusError:      { en: 'Could not generate insight', fr: "Impossible de générer l'insight", pt: 'Não foi possível gerar o insight' },
            aiStatusRetryLater: { en: 'AI temporarily unavailable, try again later', fr: 'IA temporairement indisponible, réessayez plus tard', pt: 'IA temporariamente indisponível, tente mais tarde' },
            aiOutputPlaceholder:{ en: 'When connected, this will summarize today in Mindelo and Lausanne.', fr: "Une fois connecté, ceci résumera la journée à Mindelo et Lausanne.", pt: 'Quando estiver ligado, isto vai resumir o dia em Mindelo e Lausanne.' },
            aiDisclaimerFallback:{ en: 'AI-generated content may contain mistakes.', fr: "Contenu généré par IA, pouvant contenir des erreurs.", pt: 'Conteúdo gerado por IA, pode conter erros.' },
            aiLogDownload:      { en: 'Download message log', fr: 'Télécharger le journal des messages', pt: 'Baixar registo de mensagens' },

            // ---- Weather ----
            weatherTitle:       { en: 'Weather Comparison', fr: 'Comparaison météo', pt: 'Comparação meteorológica' },
            weatherSubtitle:    { en: 'Live conditions in both cities', fr: 'Conditions en direct dans les deux villes', pt: 'Condições em tempo real nas duas cidades' },
            weatherCvTitle:     { en: '🇨🇻 Mindelo Weather', fr: '🇨🇻 Météo Mindelo', pt: '🇨🇻 Tempo em Mindelo' },
            weatherChTitle:     { en: '🇨🇭 Lausanne Weather', fr: '🇨🇭 Météo Lausanne', pt: '🇨🇭 Tempo em Lausanne' },
            weatherLoading:     { en: 'Loading weather data...', fr: 'Chargement des données météo...', pt: 'A carregar dados meteorológicos...' },
            weatherUnavailable: { en: 'Weather unavailable', fr: 'Météo indisponible', pt: 'Tempo indisponível' },
            weatherFetchError:  { en: 'Could not fetch weather data', fr: 'Impossible de récupérer la météo', pt: 'Não foi possível obter dados meteorológicos' },
            feelsLike:          { en: 'Feels', fr: 'Ressenti', pt: 'Sensação' },
            updatedLabel:       { en: 'Updated', fr: 'Mis à jour', pt: 'Atualizado' },
            updatedJustNow:     { en: 'just now', fr: "à l'instant", pt: 'agora mesmo' },
            minute:             { en: 'min', fr: 'min', pt: 'min' },
            minutes:            { en: 'min', fr: 'min', pt: 'min' },
            ago:                { en: 'ago', fr: '', pt: 'atrás' },
            usingCachedData:    { en: 'using cached data', fr: 'données en cache', pt: 'usando dados em cache' },
            offlineMode:        { en: 'offline mode', fr: 'mode hors ligne', pt: 'modo offline' },
            weatherNoData:      { en: 'No live or cached weather data', fr: 'Aucune donnée météo en direct ou en cache', pt: 'Sem dados meteorológicos ao vivo ou em cache' },
            sunTitle:           { en: 'Sunrise & Day Length', fr: 'Lever du soleil & durée du jour', pt: 'Nascer do sol e duração do dia' },
            sunSubtitle:        { en: "Today's sunlight in both cities", fr: "Ensoleillement d'aujourd'hui dans les deux villes", pt: 'Luz solar de hoje nas duas cidades' },
            sunCvTitle:         { en: '🇨🇻 Mindelo Sun', fr: '🇨🇻 Soleil à Mindelo', pt: '🇨🇻 Sol em Mindelo' },
            sunChTitle:         { en: '🇨🇭 Lausanne Sun', fr: '🇨🇭 Soleil à Lausanne', pt: '🇨🇭 Sol em Lausanne' },
            sunrise:            { en: 'Sunrise', fr: 'Lever', pt: 'Nascer' },
            sunset:             { en: 'Sunset', fr: 'Coucher', pt: 'Pôr do sol' },
            dayLength:          { en: 'Day Length', fr: 'Durée du jour', pt: 'Duração do dia' },
            daylightDiffPrefix: { en: 'Daylight difference', fr: 'Différence de lumière', pt: 'Diferença de luz do dia' },
            daylightLongerIn:   { en: 'longer in', fr: 'plus long à', pt: 'mais longo em' },
            daylightSame:       { en: 'Same day length in both cities today', fr: 'Même durée du jour dans les deux villes aujourd’hui', pt: 'Mesma duração do dia nas duas cidades hoje' },
            cityMindelo:        { en: 'Mindelo', fr: 'Mindelo', pt: 'Mindelo' },
            cityLausanne:       { en: 'Lausanne', fr: 'Lausanne', pt: 'Lausanne' },
            sunDataUnavailable: { en: 'Solar data unavailable', fr: 'Données solaires indisponibles', pt: 'Dados solares indisponíveis' },

            // ---- Calendar ----
            calendarTitle:      { en: 'Cultural Calendar', fr: 'Calendrier culturel', pt: 'Calendário cultural' },
            calendarSubtitle:   { en: 'Upcoming holidays & events', fr: 'Fêtes & événements à venir', pt: 'Feriados e eventos futuros' },
            calendarCvTitle:    { en: 'Cabo Verde & Mindelo', fr: 'Cabo Verde & Mindelo', pt: 'Cabo Verde & Mindelo' },
            calendarChTitle:    { en: 'Lausanne & Vaud', fr: 'Lausanne & Vaud', pt: 'Lausanne & Vaud' },
            nextUp:             { en: 'Next up', fr: 'Prochain', pt: 'Próximo' },
            events:             { en: 'events', fr: 'événements', pt: 'eventos' },

            // ---- Media ----
            mediaTitle:         { en: 'News & Media', fr: 'Actualités & Médias', pt: 'Notícias e Media' },
            mediaSubtitle:      { en: "Stay connected with what's happening back home", fr: 'Restez connecté à ce qui se passe chez vous', pt: 'Mantenha-se ligado ao que acontece em casa' },
            mediaCvTitle:       { en: '🇨🇻 Cabo Verde & Mindelo', fr: '🇨🇻 Cabo Verde & Mindelo', pt: '🇨🇻 Cabo Verde & Mindelo' },
            mediaChTitle:       { en: '🇨🇭 Lausanne & Vaud', fr: '🇨🇭 Lausanne & Vaud', pt: '🇨🇭 Lausanne & Vaud' },
            // Media type labels
            mediaTypeSvNews:    { en: 'São Vicente news', fr: 'Actualités São Vicente', pt: 'Notícias São Vicente' },
            mediaTypeAggregator:{ en: 'Aggregator', fr: 'Agrégateur', pt: 'Agregador' },
            mediaTypeWeekly:    { en: 'Weekly newspaper', fr: 'Hebdomadaire', pt: 'Semanário' },
            mediaTypeDaily:     { en: 'Daily newspaper', fr: 'Quotidien', pt: 'Diário' },
            mediaTypeAgency:    { en: 'News agency', fr: "Agence de presse", pt: 'Agência de notícias' },
            mediaTypeNewspaper: { en: 'Newspaper', fr: 'Journal', pt: 'Jornal' },
            mediaTypeMagazine:  { en: 'Magazine', fr: 'Magazine', pt: 'Revista' },
            mediaTypeTvRadio:   { en: 'TV & Radio', fr: 'TV & Radio', pt: 'TV & Rádio' },
            mediaTypePublic:    { en: 'Public broadcaster', fr: 'Service public', pt: 'Serviço público' },
            mediaTypeFreeDaily: { en: 'Free daily', fr: 'Gratuit quotidien', pt: 'Diário gratuito' },
            mediaTypeVaudDaily: { en: 'Vaud daily', fr: 'Quotidien vaudois', pt: 'Diário de Vaud' },
            mediaTypeRomande:   { en: 'Suisse romande', fr: 'Suisse romande', pt: 'Suíça romanda' },
            mediaTypeTabloid:   { en: 'Tabloid', fr: 'Tabloïd', pt: 'Tablóide' },
            mediaTypeLocalWeekly:{ en: 'Local weekly', fr: 'Hebdomadaire local', pt: 'Semanário local' },

            // ---- Neuro ----
            neuroTitle:         { en: '🧠 Daily Brain Insight', fr: '🧠 Astuce cérébrale du jour', pt: '🧠 Curiosidade cerebral do dia' },

            // ---- Footer ----
            footerText:         { en: 'Connecting two homes across the Atlantic', fr: "Connecter deux foyers à travers l'Atlantique", pt: 'A ligar duas casas através do Atlântico' },

            // ---- WMO Weather descriptions ----
            wmo0:  { en: 'Clear sky', fr: 'Ciel dégagé', pt: 'Céu limpo' },
            wmo1:  { en: 'Mainly clear', fr: 'Principalement dégagé', pt: 'Predominantemente limpo' },
            wmo2:  { en: 'Partly cloudy', fr: 'Partiellement nuageux', pt: 'Parcialmente nublado' },
            wmo3:  { en: 'Overcast', fr: 'Couvert', pt: 'Encoberto' },
            wmo45: { en: 'Fog', fr: 'Brouillard', pt: 'Nevoeiro' },
            wmo48: { en: 'Depositing rime fog', fr: 'Brouillard givrant', pt: 'Nevoeiro com geada' },
            wmo51: { en: 'Light drizzle', fr: 'Bruine légère', pt: 'Chuviscos leves' },
            wmo53: { en: 'Moderate drizzle', fr: 'Bruine modérée', pt: 'Chuviscos moderados' },
            wmo55: { en: 'Dense drizzle', fr: 'Bruine dense', pt: 'Chuviscos intensos' },
            wmo61: { en: 'Slight rain', fr: 'Pluie légère', pt: 'Chuva fraca' },
            wmo63: { en: 'Moderate rain', fr: 'Pluie modérée', pt: 'Chuva moderada' },
            wmo65: { en: 'Heavy rain', fr: 'Pluie forte', pt: 'Chuva forte' },
            wmo71: { en: 'Slight snow', fr: 'Neige légère', pt: 'Neve fraca' },
            wmo73: { en: 'Moderate snow', fr: 'Neige modérée', pt: 'Neve moderada' },
            wmo75: { en: 'Heavy snow', fr: 'Neige forte', pt: 'Neve forte' },
            wmo77: { en: 'Snow grains', fr: 'Grains de neige', pt: 'Grãos de neve' },
            wmo80: { en: 'Slight showers', fr: 'Averses légères', pt: 'Aguaceiros fracos' },
            wmo81: { en: 'Moderate showers', fr: 'Averses modérées', pt: 'Aguaceiros moderados' },
            wmo82: { en: 'Violent showers', fr: 'Averses violentes', pt: 'Aguaceiros fortes' },
            wmo85: { en: 'Slight snow showers', fr: 'Averses de neige légères', pt: 'Aguaceiros de neve fracos' },
            wmo86: { en: 'Heavy snow showers', fr: 'Averses de neige fortes', pt: 'Aguaceiros de neve fortes' },
            wmo95: { en: 'Thunderstorm', fr: 'Orage', pt: 'Trovoada' },
            wmo96: { en: 'Thunderstorm with slight hail', fr: 'Orage avec grêle légère', pt: 'Trovoada com granizo fraco' },
            wmo99: { en: 'Thunderstorm with heavy hail', fr: 'Orage avec forte grêle', pt: 'Trovoada com granizo forte' },
        };

        // ---- "What's Happening" texts per language ----
        const happeningCV = {
            en: [
                { start: 0, end: 5, emoji: '🌙', text: 'Mindelo is sleeping under the Atlantic stars' },
                { start: 5, end: 7, emoji: '🌅', text: 'Early risers in Mindelo are watching the sunrise over the bay' },
                { start: 7, end: 9, emoji: '☕', text: 'Mindelo is waking up — coffee and fresh bread at the padaria' },
                { start: 9, end: 11, emoji: '🏪', text: 'The Mercado Municipal is buzzing with fresh fish and produce' },
                { start: 11, end: 12, emoji: '🎵', text: 'Morna music drifts through the streets of Mindelo' },
                { start: 12, end: 14, emoji: '🍽️', text: 'Your family in Mindelo is having lunch — cachupa is on the table' },
                { start: 14, end: 16, emoji: '🌊', text: 'Afternoon in Mindelo — perfect time for a walk along Laginha beach' },
                { start: 16, end: 18, emoji: '⚽', text: 'Kids are playing football on the streets of Mindelo' },
                { start: 18, end: 19, emoji: '🌇', text: 'Golden hour in Mindelo — the bay glows with warm light' },
                { start: 19, end: 20, emoji: '🍷', text: 'Grogue time — Mindelo is settling into the evening' },
                { start: 20, end: 21, emoji: '🎶', text: 'Live music fills the bars along Rua de Lisboa' },
                { start: 21, end: 23, emoji: '🌃', text: "Mindelo nightlife is coming alive — the city of Cesária Évora never sleeps early" },
                { start: 23, end: 24, emoji: '🌙', text: 'Late night in Mindelo — the Atlantic breeze cools the city' }
            ],
            fr: [
                { start: 0, end: 5, emoji: '🌙', text: 'Mindelo dort sous les étoiles de l\'Atlantique' },
                { start: 5, end: 7, emoji: '🌅', text: 'Les lève-tôt de Mindelo regardent le lever du soleil sur la baie' },
                { start: 7, end: 9, emoji: '☕', text: 'Mindelo se réveille — café et pain frais à la padaria' },
                { start: 9, end: 11, emoji: '🏪', text: 'Le Mercado Municipal est animé — poissons frais et légumes' },
                { start: 11, end: 12, emoji: '🎵', text: 'La morna résonne dans les rues de Mindelo' },
                { start: 12, end: 14, emoji: '🍽️', text: 'Votre famille à Mindelo déjeune — la cachupa est sur la table' },
                { start: 14, end: 16, emoji: '🌊', text: 'Après-midi à Mindelo — parfait pour une promenade sur la plage de Laginha' },
                { start: 16, end: 18, emoji: '⚽', text: 'Les enfants jouent au football dans les rues de Mindelo' },
                { start: 18, end: 19, emoji: '🌇', text: 'Heure dorée à Mindelo — la baie brille de lumière chaude' },
                { start: 19, end: 20, emoji: '🍷', text: 'L\'heure du grogue — Mindelo s\'installe dans la soirée' },
                { start: 20, end: 21, emoji: '🎶', text: 'La musique live remplit les bars de la Rua de Lisboa' },
                { start: 21, end: 23, emoji: '🌃', text: 'La vie nocturne de Mindelo s\'anime — la ville de Cesária Évora ne dort jamais tôt' },
                { start: 23, end: 24, emoji: '🌙', text: 'Nuit tardive à Mindelo — la brise atlantique rafraîchit la ville' }
            ],
            pt: [
                { start: 0, end: 5, emoji: '🌙', text: 'Mindelo dorme sob as estrelas do Atlântico' },
                { start: 5, end: 7, emoji: '🌅', text: 'Os madrugadores de Mindelo observam o nascer do sol sobre a baía' },
                { start: 7, end: 9, emoji: '☕', text: 'Mindelo acorda — café e pão fresco na padaria' },
                { start: 9, end: 11, emoji: '🏪', text: 'O Mercado Municipal está animado — peixe fresco e produtos da terra' },
                { start: 11, end: 12, emoji: '🎵', text: 'A morna flui pelas ruas de Mindelo' },
                { start: 12, end: 14, emoji: '🍽️', text: 'A sua família em Mindelo está a almoçar — cachupa na mesa' },
                { start: 14, end: 16, emoji: '🌊', text: 'Tarde em Mindelo — perfeito para um passeio pela praia de Laginha' },
                { start: 16, end: 18, emoji: '⚽', text: 'Os miúdos jogam futebol nas ruas de Mindelo' },
                { start: 18, end: 19, emoji: '🌇', text: 'Hora dourada em Mindelo — a baía brilha com luz quente' },
                { start: 19, end: 20, emoji: '🍷', text: 'Hora do grogue — Mindelo entra pela noite' },
                { start: 20, end: 21, emoji: '🎶', text: 'Música ao vivo enche os bares da Rua de Lisboa' },
                { start: 21, end: 23, emoji: '🌃', text: 'A vida nocturna de Mindelo ganha vida — a cidade de Cesária Évora nunca dorme cedo' },
                { start: 23, end: 24, emoji: '🌙', text: 'Noite avançada em Mindelo — a brisa atlântica refresca a cidade' }
            ]
        };

        const happeningCH = {
            en: [
                { start: 0, end: 5, emoji: '🌙', text: 'Lausanne is asleep — the Alps stand guard in the moonlight' },
                { start: 5, end: 7, emoji: '🏔️', text: 'Dawn breaks over Lake Geneva and the Alpine peaks' },
                { start: 7, end: 9, emoji: '🥐', text: 'Lausanne is having breakfast — croissants and café au lait' },
                { start: 9, end: 11, emoji: '💼', text: 'The workday is underway in Lausanne — EPFL buzzes with ideas' },
                { start: 11, end: 12, emoji: '📚', text: 'Mid-morning in Lausanne — labs and lectures in full swing' },
                { start: 12, end: 13, emoji: '🧀', text: 'Lunch break in Lausanne — fondue or a lakeside sandwich' },
                { start: 13, end: 15, emoji: '🏢', text: 'Afternoon productivity in Lausanne — the Swiss clockwork keeps ticking' },
                { start: 15, end: 16, emoji: '☕', text: 'Coffee break in Lausanne — time for a quick espresso' },
                { start: 16, end: 18, emoji: '🚶', text: 'Lausanne winds down — people stroll along the Ouchy waterfront' },
                { start: 18, end: 19, emoji: '🏠', text: 'Heading home in Lausanne — the Métro carries commuters uphill' },
                { start: 19, end: 21, emoji: '🍷', text: 'Lausanne is winding down for the evening — dinner time with Swiss wine' },
                { start: 21, end: 22, emoji: '📖', text: 'Quiet evening in Lausanne — reading by the window with lake views' },
                { start: 22, end: 24, emoji: '🌙', text: 'Lausanne is settling in for the night — bonne nuit!' }
            ],
            fr: [
                { start: 0, end: 5, emoji: '🌙', text: 'Lausanne dort — les Alpes veillent au clair de lune' },
                { start: 5, end: 7, emoji: '🏔️', text: 'L\'aube se lève sur le lac Léman et les sommets alpins' },
                { start: 7, end: 9, emoji: '🥐', text: 'Lausanne prend le petit-déjeuner — croissants et café au lait' },
                { start: 9, end: 11, emoji: '💼', text: 'La journée de travail bat son plein à Lausanne — l\'EPFL bouillonne d\'idées' },
                { start: 11, end: 12, emoji: '📚', text: 'Mi-matinée à Lausanne — labos et cours à plein régime' },
                { start: 12, end: 13, emoji: '🧀', text: 'Pause déjeuner à Lausanne — fondue ou sandwich au bord du lac' },
                { start: 13, end: 15, emoji: '🏢', text: 'Productivité de l\'après-midi à Lausanne — la mécanique suisse tourne' },
                { start: 15, end: 16, emoji: '☕', text: 'Pause café à Lausanne — un petit espresso' },
                { start: 16, end: 18, emoji: '🚶', text: 'Lausanne ralentit — les gens se promènent le long du quai d\'Ouchy' },
                { start: 18, end: 19, emoji: '🏠', text: 'Retour à la maison à Lausanne — le Métro remonte les pendulaires' },
                { start: 19, end: 21, emoji: '🍷', text: 'Lausanne se détend — l\'heure du dîner avec un vin suisse' },
                { start: 21, end: 22, emoji: '📖', text: 'Soirée tranquille à Lausanne — lecture avec vue sur le lac' },
                { start: 22, end: 24, emoji: '🌙', text: 'Lausanne s\'endort — bonne nuit !' }
            ],
            pt: [
                { start: 0, end: 5, emoji: '🌙', text: 'Lausanne dorme — os Alpes vigiam ao luar' },
                { start: 5, end: 7, emoji: '🏔️', text: 'A aurora nasce sobre o Lago Léman e os picos alpinos' },
                { start: 7, end: 9, emoji: '🥐', text: 'Lausanne toma o pequeno-almoço — croissants e café com leite' },
                { start: 9, end: 11, emoji: '💼', text: 'O dia de trabalho arranca em Lausanne — a EPFL fervilha de ideias' },
                { start: 11, end: 12, emoji: '📚', text: 'Meio da manhã em Lausanne — laboratórios e aulas a todo o vapor' },
                { start: 12, end: 13, emoji: '🧀', text: 'Pausa para almoço em Lausanne — fondue ou sanduíche à beira do lago' },
                { start: 13, end: 15, emoji: '🏢', text: 'Tarde produtiva em Lausanne — o mecanismo suíço continua a funcionar' },
                { start: 15, end: 16, emoji: '☕', text: 'Pausa para café em Lausanne — hora de um espresso rápido' },
                { start: 16, end: 18, emoji: '🚶', text: 'Lausanne abranda — as pessoas passeiam pelo cais de Ouchy' },
                { start: 18, end: 19, emoji: '🏠', text: 'A caminho de casa em Lausanne — o Métro leva os pendulares colina acima' },
                { start: 19, end: 21, emoji: '🍷', text: 'Lausanne relaxa ao fim do dia — hora de jantar com vinho suíço' },
                { start: 21, end: 22, emoji: '📖', text: 'Noite tranquila em Lausanne — leitura com vista para o lago' },
                { start: 22, end: 24, emoji: '🌙', text: 'Lausanne adormece — bonne nuit!' }
            ]
        };

        const happeningCVWeekend = {
            sat: {
                en: [
                    { start: 0, end: 5, emoji: '🌙', text: 'Saturday night in Mindelo is still quiet under Atlantic stars' },
                    { start: 5, end: 7, emoji: '🌅', text: 'Early Saturday sunrise over Mindelo bay' },
                    { start: 7, end: 9, emoji: '☕', text: 'Slow Saturday breakfast in Mindelo — coffee and fresh bread' },
                    { start: 9, end: 11, emoji: '🛍️', text: 'Saturday groceries at Mercado Municipal — fish, fruit, and vegetables' },
                    { start: 11, end: 12, emoji: '🧺', text: 'Weekend errands around Mindelo before lunch' },
                    { start: 12, end: 14, emoji: '🍽️', text: 'Saturday family lunch in Mindelo — long table, no rush' },
                    { start: 14, end: 16, emoji: '🏖️', text: 'Beach time in Mindelo — Laginha is lively' },
                    { start: 16, end: 18, emoji: '🌊', text: 'Late afternoon by the sea in Mindelo with friends and family' },
                    { start: 18, end: 19, emoji: '🌇', text: 'Saturday golden hour paints the bay in warm colors' },
                    { start: 19, end: 20, emoji: '🍢', text: 'Weekend dinner plans start in Mindelo' },
                    { start: 20, end: 21, emoji: '🎶', text: 'Live music and weekend energy in Mindelo' },
                    { start: 21, end: 23, emoji: '🌃', text: 'Saturday night in Mindelo is in full swing' },
                    { start: 23, end: 24, emoji: '🌙', text: 'Late Saturday breeze cools Mindelo' }
                ],
                fr: [
                    { start: 0, end: 5, emoji: '🌙', text: 'La nuit de samedi à Mindelo reste calme sous les étoiles atlantiques' },
                    { start: 5, end: 7, emoji: '🌅', text: 'Lever de soleil du samedi sur la baie de Mindelo' },
                    { start: 7, end: 9, emoji: '☕', text: 'Petit-déjeuner tranquille du samedi à Mindelo — café et pain frais' },
                    { start: 9, end: 11, emoji: '🛍️', text: 'Courses du samedi au Mercado Municipal — poisson, fruits et légumes' },
                    { start: 11, end: 12, emoji: '🧺', text: 'Petites courses de week-end à Mindelo avant le déjeuner' },
                    { start: 12, end: 14, emoji: '🍽️', text: 'Déjeuner familial du samedi à Mindelo — on prend le temps' },
                    { start: 14, end: 16, emoji: '🏖️', text: 'Direction la plage à Mindelo — Laginha est animée' },
                    { start: 16, end: 18, emoji: '🌊', text: 'Fin d’après-midi au bord de la mer à Mindelo en famille' },
                    { start: 18, end: 19, emoji: '🌇', text: 'Heure dorée du samedi sur la baie de Mindelo' },
                    { start: 19, end: 20, emoji: '🍢', text: 'Les plans du dîner de week-end commencent à Mindelo' },
                    { start: 20, end: 21, emoji: '🎶', text: 'Musique live et ambiance de week-end à Mindelo' },
                    { start: 21, end: 23, emoji: '🌃', text: 'La nuit de samedi bat son plein à Mindelo' },
                    { start: 23, end: 24, emoji: '🌙', text: 'La brise tardive du samedi rafraîchit Mindelo' }
                ],
                pt: [
                    { start: 0, end: 5, emoji: '🌙', text: 'A noite de sábado em Mindelo ainda está calma sob as estrelas do Atlântico' },
                    { start: 5, end: 7, emoji: '🌅', text: 'Nascer do sol de sábado sobre a baía de Mindelo' },
                    { start: 7, end: 9, emoji: '☕', text: 'Pequeno-almoço de sábado sem pressa em Mindelo — café e pão fresco' },
                    { start: 9, end: 11, emoji: '🛍️', text: 'Compras de sábado no Mercado Municipal — peixe, fruta e legumes' },
                    { start: 11, end: 12, emoji: '🧺', text: 'Pequenas tarefas de fim de semana em Mindelo antes do almoço' },
                    { start: 12, end: 14, emoji: '🍽️', text: 'Almoço de sábado em família em Mindelo — sem pressa' },
                    { start: 14, end: 16, emoji: '🏖️', text: 'Hora de praia em Mindelo — Laginha está cheia de vida' },
                    { start: 16, end: 18, emoji: '🌊', text: 'Fim de tarde à beira-mar em Mindelo com família e amigos' },
                    { start: 18, end: 19, emoji: '🌇', text: 'Hora dourada de sábado pinta a baía de Mindelo' },
                    { start: 19, end: 20, emoji: '🍢', text: 'Começam os planos de jantar de fim de semana em Mindelo' },
                    { start: 20, end: 21, emoji: '🎶', text: 'Música ao vivo e energia de sábado em Mindelo' },
                    { start: 21, end: 23, emoji: '🌃', text: 'A noite de sábado em Mindelo está no auge' },
                    { start: 23, end: 24, emoji: '🌙', text: 'A brisa tardia de sábado refresca Mindelo' }
                ]
            },
            sun: {
                en: [
                    { start: 0, end: 5, emoji: '🌙', text: 'Sunday night is calm in Mindelo before a beach day' },
                    { start: 5, end: 7, emoji: '🌅', text: 'Sunday sunrise in Mindelo — perfect beach weather ahead' },
                    { start: 7, end: 9, emoji: '🥖', text: 'Easy Sunday morning in Mindelo — bakery stop and coffee' },
                    { start: 9, end: 11, emoji: '🏖️', text: 'Families are heading to the beach in Mindelo' },
                    { start: 11, end: 12, emoji: '🌴', text: 'Beach umbrellas and ocean breeze across Mindelo' },
                    { start: 12, end: 14, emoji: '🍉', text: 'Sunday beach lunch in Mindelo — relaxed and sunny' },
                    { start: 14, end: 16, emoji: '🌊', text: 'Peak beach time in Mindelo — swimming and long chats' },
                    { start: 16, end: 18, emoji: '🏐', text: 'Late Sunday games and walks by the sea in Mindelo' },
                    { start: 18, end: 19, emoji: '🌇', text: 'Sunset glow over a beach-filled Sunday in Mindelo' },
                    { start: 19, end: 20, emoji: '🍲', text: 'Sunday dinner in Mindelo after a full day at the beach' },
                    { start: 20, end: 21, emoji: '🎵', text: 'Calm Sunday evening music in Mindelo' },
                    { start: 21, end: 23, emoji: '🌃', text: 'Mindelo slows down on Sunday night' },
                    { start: 23, end: 24, emoji: '🌙', text: 'Quiet Sunday late night in Mindelo' }
                ],
                fr: [
                    { start: 0, end: 5, emoji: '🌙', text: 'La nuit de dimanche est calme à Mindelo avant la journée plage' },
                    { start: 5, end: 7, emoji: '🌅', text: 'Lever du soleil dominical à Mindelo — météo parfaite pour la plage' },
                    { start: 7, end: 9, emoji: '🥖', text: 'Dimanche matin tranquille à Mindelo — boulangerie et café' },
                    { start: 9, end: 11, emoji: '🏖️', text: 'Les familles partent à la plage à Mindelo' },
                    { start: 11, end: 12, emoji: '🌴', text: 'Parasol et brise marine partout à Mindelo' },
                    { start: 12, end: 14, emoji: '🍉', text: 'Déjeuner du dimanche à la plage à Mindelo — détendu et ensoleillé' },
                    { start: 14, end: 16, emoji: '🌊', text: 'Plein temps plage à Mindelo — baignade et longues discussions' },
                    { start: 16, end: 18, emoji: '🏐', text: 'Fin d’après-midi du dimanche entre jeux et balade en bord de mer à Mindelo' },
                    { start: 18, end: 19, emoji: '🌇', text: 'Coucher de soleil sur un dimanche plage à Mindelo' },
                    { start: 19, end: 20, emoji: '🍲', text: 'Dîner du dimanche à Mindelo après la plage' },
                    { start: 20, end: 21, emoji: '🎵', text: 'Musique douce du dimanche soir à Mindelo' },
                    { start: 21, end: 23, emoji: '🌃', text: 'Mindelo ralentit le dimanche soir' },
                    { start: 23, end: 24, emoji: '🌙', text: 'Fin de nuit dominicale paisible à Mindelo' }
                ],
                pt: [
                    { start: 0, end: 5, emoji: '🌙', text: 'A noite de domingo é calma em Mindelo antes do dia de praia' },
                    { start: 5, end: 7, emoji: '🌅', text: 'Nascer do sol de domingo em Mindelo — dia perfeito para a praia' },
                    { start: 7, end: 9, emoji: '🥖', text: 'Domingo de manhã tranquilo em Mindelo — padaria e café' },
                    { start: 9, end: 11, emoji: '🏖️', text: 'As famílias seguem para a praia em Mindelo' },
                    { start: 11, end: 12, emoji: '🌴', text: 'Sombrinhas e brisa do mar por todo o Mindelo' },
                    { start: 12, end: 14, emoji: '🍉', text: 'Almoço de domingo na praia em Mindelo — relaxado e com sol' },
                    { start: 14, end: 16, emoji: '🌊', text: 'Hora alta de praia em Mindelo — mergulhos e conversa longa' },
                    { start: 16, end: 18, emoji: '🏐', text: 'Fim de tarde de domingo com jogos e passeios à beira-mar em Mindelo' },
                    { start: 18, end: 19, emoji: '🌇', text: 'Pôr do sol sobre um domingo de praia em Mindelo' },
                    { start: 19, end: 20, emoji: '🍲', text: 'Jantar de domingo em Mindelo depois de um dia inteiro de praia' },
                    { start: 20, end: 21, emoji: '🎵', text: 'Música calma no domingo à noite em Mindelo' },
                    { start: 21, end: 23, emoji: '🌃', text: 'Mindelo abranda na noite de domingo' },
                    { start: 23, end: 24, emoji: '🌙', text: 'Fim de noite de domingo tranquilo em Mindelo' }
                ]
            }
        };

        const happeningCHWeekend = {
            sat: {
                en: [
                    { start: 0, end: 5, emoji: '🌙', text: 'Saturday night is quiet in Lausanne' },
                    { start: 5, end: 7, emoji: '🏔️', text: 'Saturday dawn over Lake Geneva and the Alps' },
                    { start: 7, end: 9, emoji: '🥐', text: 'Slow Saturday breakfast in Lausanne' },
                    { start: 9, end: 11, emoji: '🛒', text: 'Saturday groceries at the market in Lausanne' },
                    { start: 11, end: 12, emoji: '🧺', text: 'Weekend errands in Lausanne before lunch' },
                    { start: 12, end: 13, emoji: '🍴', text: 'Long Saturday lunch on a terrace in Lausanne' },
                    { start: 13, end: 15, emoji: '🚲', text: 'Weekend afternoon in Lausanne — lakeside walk or bike ride' },
                    { start: 15, end: 16, emoji: '☕', text: 'Saturday coffee break in Lausanne with friends' },
                    { start: 16, end: 18, emoji: '🌅', text: 'Late Saturday by the lake in Lausanne' },
                    { start: 18, end: 19, emoji: '🏠', text: 'Heading home for Saturday evening plans in Lausanne' },
                    { start: 19, end: 21, emoji: '🍷', text: 'Saturday night dinner in Lausanne' },
                    { start: 21, end: 22, emoji: '🎬', text: 'Cinema or drinks on a Saturday night in Lausanne' },
                    { start: 22, end: 24, emoji: '🌙', text: 'Lausanne settles into late Saturday night' }
                ],
                fr: [
                    { start: 0, end: 5, emoji: '🌙', text: 'La nuit de samedi est calme à Lausanne' },
                    { start: 5, end: 7, emoji: '🏔️', text: 'Aube du samedi sur le lac Léman et les Alpes' },
                    { start: 7, end: 9, emoji: '🥐', text: 'Petit-déjeuner du samedi sans stress à Lausanne' },
                    { start: 9, end: 11, emoji: '🛒', text: 'Courses du samedi au marché à Lausanne' },
                    { start: 11, end: 12, emoji: '🧺', text: 'Petites tâches du week-end à Lausanne avant le déjeuner' },
                    { start: 12, end: 13, emoji: '🍴', text: 'Long déjeuner du samedi en terrasse à Lausanne' },
                    { start: 13, end: 15, emoji: '🚲', text: 'Après-midi de week-end à Lausanne — promenade ou vélo au bord du lac' },
                    { start: 15, end: 16, emoji: '☕', text: 'Pause café du samedi à Lausanne entre amis' },
                    { start: 16, end: 18, emoji: '🌅', text: 'Fin de samedi au bord du lac à Lausanne' },
                    { start: 18, end: 19, emoji: '🏠', text: 'Retour à la maison pour la soirée de samedi à Lausanne' },
                    { start: 19, end: 21, emoji: '🍷', text: 'Dîner du samedi soir à Lausanne' },
                    { start: 21, end: 22, emoji: '🎬', text: 'Cinéma ou sortie entre amis un samedi soir à Lausanne' },
                    { start: 22, end: 24, emoji: '🌙', text: 'Lausanne se pose en fin de nuit de samedi' }
                ],
                pt: [
                    { start: 0, end: 5, emoji: '🌙', text: 'A noite de sábado está calma em Lausanne' },
                    { start: 5, end: 7, emoji: '🏔️', text: 'Aurora de sábado sobre o Lago Léman e os Alpes' },
                    { start: 7, end: 9, emoji: '🥐', text: 'Pequeno-almoço de sábado sem pressa em Lausanne' },
                    { start: 9, end: 11, emoji: '🛒', text: 'Compras de sábado no mercado em Lausanne' },
                    { start: 11, end: 12, emoji: '🧺', text: 'Pequenas tarefas de fim de semana em Lausanne antes do almoço' },
                    { start: 12, end: 13, emoji: '🍴', text: 'Almoço longo de sábado numa esplanada em Lausanne' },
                    { start: 13, end: 15, emoji: '🚲', text: 'Tarde de fim de semana em Lausanne — passeio ou bicicleta junto ao lago' },
                    { start: 15, end: 16, emoji: '☕', text: 'Pausa para café de sábado em Lausanne com amigos' },
                    { start: 16, end: 18, emoji: '🌅', text: 'Fim de tarde de sábado junto ao lago em Lausanne' },
                    { start: 18, end: 19, emoji: '🏠', text: 'Regresso a casa para os planos de sábado à noite em Lausanne' },
                    { start: 19, end: 21, emoji: '🍷', text: 'Jantar de sábado à noite em Lausanne' },
                    { start: 21, end: 22, emoji: '🎬', text: 'Cinema ou saída com amigos no sábado à noite em Lausanne' },
                    { start: 22, end: 24, emoji: '🌙', text: 'Lausanne acalma no fim da noite de sábado' }
                ]
            },
            sun: {
                en: [
                    { start: 0, end: 5, emoji: '🌙', text: 'Sunday night in Lausanne is calm before mountain plans' },
                    { start: 5, end: 7, emoji: '🏔️', text: 'Sunday sunrise over Lausanne — alpine day ahead' },
                    { start: 7, end: 9, emoji: '🥐', text: 'Early Sunday breakfast before heading to the Alps' },
                    { start: 9, end: 11, emoji: '🎿', text: 'Sunday ski departures from Lausanne toward nearby resorts' },
                    { start: 11, end: 12, emoji: '🏂', text: 'On the slopes above Lausanne — fresh mountain air' },
                    { start: 12, end: 13, emoji: '🍲', text: 'Sunday mountain lunch after morning skiing' },
                    { start: 13, end: 15, emoji: '🎿', text: 'Afternoon skiing time near Lausanne' },
                    { start: 15, end: 16, emoji: '☕', text: 'Hot chocolate break in the mountains' },
                    { start: 16, end: 18, emoji: '🚞', text: 'Returning to Lausanne from a ski day' },
                    { start: 18, end: 19, emoji: '🏠', text: 'Back home in Lausanne after Sunday skiing' },
                    { start: 19, end: 21, emoji: '🍽️', text: 'Quiet Sunday dinner in Lausanne' },
                    { start: 21, end: 22, emoji: '📚', text: 'Preparing for the week in Lausanne' },
                    { start: 22, end: 24, emoji: '🌙', text: 'Sunday night wind-down in Lausanne' }
                ],
                fr: [
                    { start: 0, end: 5, emoji: '🌙', text: 'La nuit de dimanche à Lausanne est calme avant les plans montagne' },
                    { start: 5, end: 7, emoji: '🏔️', text: 'Lever du soleil du dimanche sur Lausanne — journée alpine en vue' },
                    { start: 7, end: 9, emoji: '🥐', text: 'Petit-déjeuner du dimanche avant de partir vers les Alpes' },
                    { start: 9, end: 11, emoji: '🎿', text: 'Départs du dimanche depuis Lausanne vers les stations de ski' },
                    { start: 11, end: 12, emoji: '🏂', text: 'Sur les pistes au-dessus de Lausanne — air frais de montagne' },
                    { start: 12, end: 13, emoji: '🍲', text: 'Déjeuner dominical en montagne après le ski du matin' },
                    { start: 13, end: 15, emoji: '🎿', text: 'Après-midi ski près de Lausanne' },
                    { start: 15, end: 16, emoji: '☕', text: 'Pause chocolat chaud à la montagne' },
                    { start: 16, end: 18, emoji: '🚞', text: 'Retour à Lausanne après la journée de ski' },
                    { start: 18, end: 19, emoji: '🏠', text: 'De retour à la maison à Lausanne après le ski' },
                    { start: 19, end: 21, emoji: '🍽️', text: 'Dîner calme du dimanche à Lausanne' },
                    { start: 21, end: 22, emoji: '📚', text: 'Préparation de la semaine à Lausanne' },
                    { start: 22, end: 24, emoji: '🌙', text: 'Fin de dimanche soir tranquille à Lausanne' }
                ],
                pt: [
                    { start: 0, end: 5, emoji: '🌙', text: 'A noite de domingo em Lausanne é calma antes dos planos de montanha' },
                    { start: 5, end: 7, emoji: '🏔️', text: 'Nascer do sol de domingo em Lausanne — dia alpino pela frente' },
                    { start: 7, end: 9, emoji: '🥐', text: 'Pequeno-almoço de domingo antes de seguir para os Alpes' },
                    { start: 9, end: 11, emoji: '🎿', text: 'Saídas de domingo de Lausanne para as estâncias de ski' },
                    { start: 11, end: 12, emoji: '🏂', text: 'Nas pistas perto de Lausanne — ar fresco da montanha' },
                    { start: 12, end: 13, emoji: '🍲', text: 'Almoço de domingo na montanha depois do ski da manhã' },
                    { start: 13, end: 15, emoji: '🎿', text: 'Tarde de ski perto de Lausanne' },
                    { start: 15, end: 16, emoji: '☕', text: 'Pausa para chocolate quente na montanha' },
                    { start: 16, end: 18, emoji: '🚞', text: 'Regresso a Lausanne depois de um dia de ski' },
                    { start: 18, end: 19, emoji: '🏠', text: 'De volta a casa em Lausanne após o ski de domingo' },
                    { start: 19, end: 21, emoji: '🍽️', text: 'Jantar calmo de domingo em Lausanne' },
                    { start: 21, end: 22, emoji: '📚', text: 'Preparação da semana em Lausanne' },
                    { start: 22, end: 24, emoji: '🌙', text: 'Final tranquilo da noite de domingo em Lausanne' }
                ]
            }
        };

        // ---- Neuroscience Tips per language ----
        const neuroTips = {
            en: [
                { category: 'Circadian Rhythms', emoji: '🌅', tip: "Your body's master clock — the suprachiasmatic nucleus — is only about the size of a grain of rice, yet it orchestrates the timing of nearly every cell in your body. Morning sunlight is its most powerful calibrator.", source: 'Chronobiology research' },
                { category: 'Jet Lag Science', emoji: '✈️', tip: "Travelling east (like Mindelo → Lausanne) is harder on your body than going west. Your internal clock naturally runs slightly longer than 24 hours, making it easier to extend your day than shorten it.", source: 'Sleep medicine research' },
                { category: 'Time Perception', emoji: '⏳', tip: "Time feels slower when you're experiencing new things. That's why holidays feel long but routine weeks fly by. Your brain creates more detailed memories for novel experiences, making them seem to last longer in retrospect.", source: 'Cognitive neuroscience' },
                { category: 'Sleep Science', emoji: '😴', tip: "During deep sleep, your brain's glymphatic system flushes out metabolic waste — including proteins linked to Alzheimer's. Think of sleep as your brain's nightly cleaning service.", source: 'Neuroscience of sleep' },
                { category: 'Social Jetlag', emoji: '⏰', tip: "Staying up late on weekends and sleeping in creates \"social jetlag\" — your body experiences it much like crossing time zones. Keeping a consistent sleep schedule, even on weekends, benefits your health.", source: 'Chronobiology research' },
                { category: 'Light & Mood', emoji: '💡', tip: "Blue light from screens suppresses melatonin production, but it's not just about sleep — light exposure patterns throughout the day also affect mood, alertness, and even immune function.", source: 'Photobiology research' },
                { category: 'Nostalgia & Time', emoji: '🎵', tip: "Music heard between ages 12-22 tends to stick with us the strongest. This \"reminiscence bump\" happens because your brain encodes memories more intensely during periods of identity formation.", source: 'Memory research' },
                { category: 'Body Temperature', emoji: '🌡️', tip: "Your body temperature follows a circadian rhythm, dropping about 1-1.5°C at night. This cooling is a signal to your brain that it's time to sleep — a cool bedroom (around 18°C) supports better rest.", source: 'Thermoregulation studies' },
                { category: 'Chronotypes', emoji: '🦉', tip: "Whether you're a morning lark or night owl is largely genetic. About 25% of people are strong morning types, 25% strong evening types, and the rest fall somewhere in between.", source: 'Behavioral genetics' },
                { category: 'Napping Science', emoji: '💤', tip: 'A 20-minute nap boosts alertness and performance without grogginess. Longer naps (90 minutes) allow a full sleep cycle and can enhance creativity and emotional memory.', source: 'Sleep research' },
                { category: 'Sodade & The Brain', emoji: '💙', tip: "Longing for home activates brain regions associated with reward and motivation — not just sadness. Sodade, that deeply Cabo Verdean feeling, is your brain's way of keeping important social bonds alive.", source: 'Social neuroscience' },
                { category: 'Bilingual Brains', emoji: '🧠', tip: 'Speaking multiple languages (like Kriolu and French) strengthens executive function and may delay cognitive decline. Each language activates slightly different neural networks, keeping your brain more flexible.', source: 'Neurolinguistics' },
                { category: 'Altitude & Cognition', emoji: '🏔️', tip: "Living at altitude (like visits to the Swiss Alps) temporarily affects cognition due to lower oxygen. But regular exposure improves your body's oxygen efficiency — mountain air literally sharpens your blood.", source: 'High-altitude physiology' },
                { category: 'Ocean & Wellbeing', emoji: '🌊', tip: "Being near the ocean — like in Mindelo — reduces cortisol and increases serotonin. The sound of waves alters brain wave patterns, promoting a meditative state. It's called \"blue mind\" science.", source: 'Environmental neuroscience' },
                { category: 'Food & Brain Clocks', emoji: '🍽️', tip: "When you eat matters almost as much as what you eat for your circadian health. Regular meal times help synchronize peripheral body clocks in your liver, gut, and muscles with your brain's master clock.", source: 'Chrononutrition research' }
            ],
            fr: [
                { category: 'Rythmes circadiens', emoji: '🌅', tip: "L'horloge maître de votre corps — le noyau suprachiasmatique — ne fait que la taille d'un grain de riz, mais orchestre le rythme de presque chaque cellule. La lumière du matin est son calibrateur le plus puissant.", source: 'Recherche en chronobiologie' },
                { category: 'Science du jet lag', emoji: '✈️', tip: "Voyager vers l'est (comme Mindelo → Lausanne) est plus difficile pour le corps que vers l'ouest. Votre horloge interne fonctionne naturellement un peu plus de 24 heures, ce qui rend plus facile d'allonger votre journée que de la raccourcir.", source: 'Médecine du sommeil' },
                { category: 'Perception du temps', emoji: '⏳', tip: "Le temps semble plus lent quand on vit de nouvelles expériences. C'est pourquoi les vacances semblent longues mais les semaines de routine filent. Votre cerveau crée des souvenirs plus détaillés pour les expériences nouvelles.", source: 'Neurosciences cognitives' },
                { category: 'Science du sommeil', emoji: '😴', tip: "Pendant le sommeil profond, le système glymphatique de votre cerveau évacue les déchets métaboliques — y compris les protéines liées à Alzheimer. Pensez au sommeil comme au service de nettoyage nocturne de votre cerveau.", source: 'Neurosciences du sommeil' },
                { category: 'Jet lag social', emoji: '⏰', tip: "Se coucher tard le week-end crée un « jet lag social » — votre corps le ressent comme un décalage horaire. Garder un horaire de sommeil régulier, même le week-end, est bénéfique pour votre santé.", source: 'Recherche en chronobiologie' },
                { category: 'Lumière & humeur', emoji: '💡', tip: "La lumière bleue des écrans supprime la production de mélatonine, mais ce n'est pas qu'une question de sommeil — les schémas d'exposition à la lumière affectent aussi l'humeur, la vigilance et même la fonction immunitaire.", source: 'Recherche en photobiologie' },
                { category: 'Nostalgie & temps', emoji: '🎵', tip: "La musique entendue entre 12 et 22 ans reste la plus marquante. Ce « pic de réminiscence » se produit parce que le cerveau encode les souvenirs plus intensément pendant les périodes de formation de l'identité.", source: 'Recherche sur la mémoire' },
                { category: 'Température corporelle', emoji: '🌡️', tip: "Votre température corporelle suit un rythme circadien, baissant d'environ 1 à 1,5°C la nuit. Ce refroidissement signale au cerveau qu'il est temps de dormir — une chambre fraîche (environ 18°C) favorise un meilleur repos.", source: 'Études sur la thermorégulation' },
                { category: 'Chronotypes', emoji: '🦉', tip: "Être lève-tôt ou couche-tard est en grande partie génétique. Environ 25% des gens sont de forts types matinaux, 25% de forts types vespéraux, et le reste se situe entre les deux.", source: 'Génétique comportementale' },
                { category: 'Science de la sieste', emoji: '💤', tip: "Une sieste de 20 minutes améliore la vigilance et les performances sans somnolence. Les siestes plus longues (90 minutes) permettent un cycle de sommeil complet et peuvent stimuler la créativité et la mémoire émotionnelle.", source: 'Recherche sur le sommeil' },
                { category: 'Sodade & le cerveau', emoji: '💙', tip: "Le mal du pays active les régions du cerveau associées à la récompense et à la motivation — pas seulement à la tristesse. La sodade, ce sentiment profondément cap-verdien, est la façon dont votre cerveau maintient les liens sociaux importants.", source: 'Neurosciences sociales' },
                { category: 'Cerveaux bilingues', emoji: '🧠', tip: "Parler plusieurs langues (comme le créole et le français) renforce les fonctions exécutives et peut retarder le déclin cognitif. Chaque langue active des réseaux neuronaux légèrement différents, gardant votre cerveau plus flexible.", source: 'Neurolinguistique' },
                { category: 'Altitude & cognition', emoji: '🏔️', tip: "Vivre en altitude (comme les Alpes suisses) affecte temporairement la cognition à cause du manque d'oxygène. Mais une exposition régulière améliore l'efficacité de l'oxygénation — l'air de la montagne aiguise littéralement votre sang.", source: 'Physiologie de haute altitude' },
                { category: 'Océan & bien-être', emoji: '🌊', tip: "Être près de l'océan — comme à Mindelo — réduit le cortisol et augmente la sérotonine. Le son des vagues modifie les ondes cérébrales, favorisant un état méditatif. C'est la science du « blue mind ».", source: 'Neurosciences environnementales' },
                { category: 'Alimentation & horloges', emoji: '🍽️', tip: "Quand vous mangez compte presque autant que ce que vous mangez pour votre santé circadienne. Des repas réguliers synchronisent les horloges périphériques du foie, de l'intestin et des muscles avec l'horloge maître du cerveau.", source: 'Recherche en chrononutrition' }
            ],
            pt: [
                { category: 'Ritmos circadianos', emoji: '🌅', tip: "O relógio-mestre do seu corpo — o núcleo supraquiasmático — tem apenas o tamanho de um grão de arroz, mas orquestra o ritmo de quase todas as células do corpo. A luz da manhã é o seu calibrador mais poderoso.", source: 'Investigação em cronobiologia' },
                { category: 'Ciência do jet lag', emoji: '✈️', tip: "Viajar para leste (como Mindelo → Lausanne) é mais difícil para o corpo do que para oeste. O relógio interno funciona naturalmente um pouco mais de 24 horas, tornando mais fácil prolongar o dia do que encurtá-lo.", source: 'Medicina do sono' },
                { category: 'Perceção do tempo', emoji: '⏳', tip: "O tempo parece mais lento quando vivemos experiências novas. Por isso as férias parecem longas e as semanas de rotina passam a correr. O cérebro cria memórias mais detalhadas para experiências novas, fazendo-as parecer mais longas.", source: 'Neurociência cognitiva' },
                { category: 'Ciência do sono', emoji: '😴', tip: "Durante o sono profundo, o sistema glinfático do cérebro elimina resíduos metabólicos — incluindo proteínas ligadas ao Alzheimer. Pense no sono como o serviço de limpeza nocturno do seu cérebro.", source: 'Neurociência do sono' },
                { category: 'Jet lag social', emoji: '⏰', tip: "Ficar acordado até tarde ao fim de semana cria « jet lag social » — o corpo sente-o como mudar de fuso horário. Manter um horário de sono regular, mesmo ao fim de semana, beneficia a sua saúde.", source: 'Investigação em cronobiologia' },
                { category: 'Luz & humor', emoji: '💡', tip: "A luz azul dos ecrãs suprime a produção de melatonina, mas não é só uma questão de sono — os padrões de exposição à luz ao longo do dia afectam também o humor, a atenção e até a função imunitária.", source: 'Investigação em fotobiologia' },
                { category: 'Nostalgia & tempo', emoji: '🎵', tip: "A música ouvida entre os 12 e os 22 anos marca-nos mais. Este « pico de reminiscência » acontece porque o cérebro codifica memórias mais intensamente durante os períodos de formação da identidade.", source: 'Investigação sobre memória' },
                { category: 'Temperatura corporal', emoji: '🌡️', tip: "A temperatura corporal segue um ritmo circadiano, baixando cerca de 1 a 1,5°C à noite. Este arrefecimento sinaliza ao cérebro que é hora de dormir — um quarto fresco (cerca de 18°C) favorece um melhor descanso.", source: 'Estudos de termorregulação' },
                { category: 'Cronotipos', emoji: '🦉', tip: "Ser madrugador ou noctívago é em grande parte genético. Cerca de 25% das pessoas são fortemente matutinas, 25% fortemente vespertinas, e o resto situa-se algures entre os dois.", source: 'Genética comportamental' },
                { category: 'Ciência da sesta', emoji: '💤', tip: "Uma sesta de 20 minutos melhora a atenção e o desempenho sem sonolência. Sestas mais longas (90 minutos) permitem um ciclo completo de sono e podem estimular a criatividade e a memória emocional.", source: 'Investigação sobre o sono' },
                { category: 'Sodade & o cérebro', emoji: '💙', tip: "A saudade de casa activa regiões cerebrais associadas à recompensa e motivação — não apenas à tristeza. A sodade, esse sentimento profundamente cabo-verdiano, é a forma do cérebro manter os laços sociais importantes.", source: 'Neurociência social' },
                { category: 'Cérebros bilingues', emoji: '🧠', tip: "Falar várias línguas (como o crioulo e o francês) fortalece as funções executivas e pode atrasar o declínio cognitivo. Cada língua activa redes neuronais ligeiramente diferentes, mantendo o cérebro mais flexível.", source: 'Neurolinguística' },
                { category: 'Altitude & cognição', emoji: '🏔️', tip: "Viver em altitude (como nos Alpes suíços) afecta temporariamente a cognição devido ao menor oxigénio. Mas a exposição regular melhora a eficiência do oxigénio — o ar da montanha afia literalmente o sangue.", source: 'Fisiologia de alta altitude' },
                { category: 'Oceano & bem-estar', emoji: '🌊', tip: "Estar perto do oceano — como em Mindelo — reduz o cortisol e aumenta a serotonina. O som das ondas altera os padrões de ondas cerebrais, promovendo um estado meditativo. É a ciência do « blue mind ».", source: 'Neurociência ambiental' },
                { category: 'Alimentação & relógios', emoji: '🍽️', tip: "Quando se come importa quase tanto como o que se come para a saúde circadiana. Refeições regulares ajudam a sincronizar os relógios periféricos do fígado, intestino e músculos com o relógio-mestre do cérebro.", source: 'Investigação em cronoNutrição' }
            ]
        };

        // ---- Calendar event descriptions per language ----
        function getCulturalEvents() {
            const year = new Date().getFullYear();
            const easter = getEasterDate(year);

            const shroveTuesday = addDays(easter, -47);
            const ashWednesday = addDays(easter, -46);
            const goodFriday = addDays(easter, -2);
            const easterMonday = addDays(easter, 1);
            const ascension = addDays(easter, 39);
            const whitMonday = addDays(easter, 50);
            const federalFast = getFederalFastMonday(year);

            const cvEvents = {
                en: [
                    { date: `${year}-01-01`, name: "Ano Novo", desc: "New Year's Day — celebrations across the islands" },
                    { date: `${year}-01-13`, name: "Dia da Liberdade e Democracia", desc: "Freedom and Democracy Day" },
                    { date: `${year}-01-20`, name: "Dia dos Heróis Nacionais", desc: "National Heroes' Day — honouring Amílcar Cabral" },
                    { date: `${year}-01-22`, name: "Dia de São Vicente", desc: "São Vicente island day — concerts on Rua de Lisboa" },
                    { date: fmt(addDays(shroveTuesday, -21)), name: "Mandingas Begin", desc: "Sunday parades of Mandingas tradition start in Mindelo" },
                    { date: fmt(shroveTuesday), name: "Carnaval — Terça de Entrudo", desc: "Shrove Tuesday — Mindelo's main Carnival parade, the biggest in Cabo Verde" },
                    { date: fmt(ashWednesday), name: "Quarta-feira de Cinzas", desc: "Ash Wednesday — national holiday, Carnival awards ceremony" },
                    { date: fmt(goodFriday), name: "Sexta-feira Santa", desc: "Good Friday" },
                    { date: `${year}-05-01`, name: "Dia do Trabalhador", desc: "Labour Day" },
                    { date: `${year}-06-01`, name: "Dia da Criança", desc: "Children's Day — festivities across the islands" },
                    { date: `${year}-06-24`, name: "São João — Kola San Djon", desc: "Midsummer festival in Ribeira de Julião — music, drumming, fire-jumping" },
                    { date: `${year}-07-05`, name: "Dia da Independência", desc: "Independence Day — Cabo Verde's national day, major concerts" },
                    { date: `${year}-08-15`, name: "Nossa Senhora da Graça", desc: "Assumption of Mary — patron saint festivities" },
                    { date: `${year}-08-15`, name: "Baía das Gatas Festival", desc: "Free open-air beach music festival near Mindelo (full moon weekend in August)" },
                    { date: `${year}-09-12`, name: "Dia da Nação", desc: "Nationality Day — celebrating Cabo Verdean identity and culture" },
                    { date: `${year}-10-01`, name: "Mindelact", desc: "International theatre festival in Mindelo (September/October)" },
                    { date: `${year}-11-01`, name: "Dia de Todos os Santos", desc: "All Saints' Day" },
                    { date: `${year}-12-25`, name: "Natal", desc: "Christmas Day — family gatherings and festive food" },
                    { date: `${year}-12-31`, name: "Réveillon", desc: "New Year's Eve — major concert on Rua de Lisboa" }
                ],
                fr: [
                    { date: `${year}-01-01`, name: "Ano Novo", desc: "Jour de l'An — célébrations à travers les îles" },
                    { date: `${year}-01-13`, name: "Dia da Liberdade e Democracia", desc: "Jour de la Liberté et de la Démocratie" },
                    { date: `${year}-01-20`, name: "Dia dos Heróis Nacionais", desc: "Jour des Héros Nationaux — en l'honneur d'Amílcar Cabral" },
                    { date: `${year}-01-22`, name: "Dia de São Vicente", desc: "Fête de l'île de São Vicente — concerts sur la Rua de Lisboa" },
                    { date: fmt(addDays(shroveTuesday, -21)), name: "Début des Mandingas", desc: "Les défilés dominicaux de la tradition des Mandingas commencent à Mindelo" },
                    { date: fmt(shroveTuesday), name: "Carnaval — Terça de Entrudo", desc: "Mardi gras — le plus grand défilé de Carnaval du Cabo Verde à Mindelo" },
                    { date: fmt(ashWednesday), name: "Quarta-feira de Cinzas", desc: "Mercredi des Cendres — jour férié, cérémonie de remise des prix du Carnaval" },
                    { date: fmt(goodFriday), name: "Sexta-feira Santa", desc: "Vendredi Saint" },
                    { date: `${year}-05-01`, name: "Dia do Trabalhador", desc: "Fête du Travail" },
                    { date: `${year}-06-01`, name: "Dia da Criança", desc: "Journée des enfants — festivités à travers les îles" },
                    { date: `${year}-06-24`, name: "São João — Kola San Djon", desc: "Festival de la Saint-Jean à Ribeira de Julião — musique, percussions, sauts de feu" },
                    { date: `${year}-07-05`, name: "Dia da Independência", desc: "Jour de l'Indépendance — fête nationale, grands concerts" },
                    { date: `${year}-08-15`, name: "Nossa Senhora da Graça", desc: "Assomption de Marie — fêtes patronales" },
                    { date: `${year}-08-15`, name: "Baía das Gatas Festival", desc: "Festival de musique en plein air gratuit près de Mindelo (week-end de pleine lune en août)" },
                    { date: `${year}-09-12`, name: "Dia da Nação", desc: "Jour de la Nation — célébration de l'identité et la culture cap-verdiennes" },
                    { date: `${year}-10-01`, name: "Mindelact", desc: "Festival international de théâtre à Mindelo (septembre/octobre)" },
                    { date: `${year}-11-01`, name: "Dia de Todos os Santos", desc: "Toussaint" },
                    { date: `${year}-12-25`, name: "Natal", desc: "Noël — repas de famille et ambiance festive" },
                    { date: `${year}-12-31`, name: "Réveillon", desc: "Réveillon du Nouvel An — grand concert sur la Rua de Lisboa" }
                ],
                pt: [
                    { date: `${year}-01-01`, name: "Ano Novo", desc: "Dia de Ano Novo — celebrações por todas as ilhas" },
                    { date: `${year}-01-13`, name: "Dia da Liberdade e Democracia", desc: "Dia da Liberdade e da Democracia" },
                    { date: `${year}-01-20`, name: "Dia dos Heróis Nacionais", desc: "Dia dos Heróis Nacionais — homenagem a Amílcar Cabral" },
                    { date: `${year}-01-22`, name: "Dia de São Vicente", desc: "Dia da ilha de São Vicente — concertos na Rua de Lisboa" },
                    { date: fmt(addDays(shroveTuesday, -21)), name: "Início dos Mandingas", desc: "Desfiles dominicais da tradição dos Mandingas começam em Mindelo" },
                    { date: fmt(shroveTuesday), name: "Carnaval — Terça de Entrudo", desc: "Terça-feira de Entrudo — o maior desfile de Carnaval de Cabo Verde em Mindelo" },
                    { date: fmt(ashWednesday), name: "Quarta-feira de Cinzas", desc: "Quarta-feira de Cinzas — feriado nacional, cerimónia de premiação do Carnaval" },
                    { date: fmt(goodFriday), name: "Sexta-feira Santa", desc: "Sexta-feira Santa" },
                    { date: `${year}-05-01`, name: "Dia do Trabalhador", desc: "Dia do Trabalhador" },
                    { date: `${year}-06-01`, name: "Dia da Criança", desc: "Dia da Criança — festividades por todas as ilhas" },
                    { date: `${year}-06-24`, name: "São João — Kola San Djon", desc: "Festival de São João em Ribeira de Julião — música, tambores, saltos sobre fogueiras" },
                    { date: `${year}-07-05`, name: "Dia da Independência", desc: "Dia da Independência — dia nacional de Cabo Verde, grandes concertos" },
                    { date: `${year}-08-15`, name: "Nossa Senhora da Graça", desc: "Assunção de Maria — festividades da santa padroeira" },
                    { date: `${year}-08-15`, name: "Baía das Gatas Festival", desc: "Festival de música gratuito ao ar livre perto de Mindelo (fim de semana de lua cheia em agosto)" },
                    { date: `${year}-09-12`, name: "Dia da Nação", desc: "Dia da Nacionalidade — celebração da identidade e cultura cabo-verdianas" },
                    { date: `${year}-10-01`, name: "Mindelact", desc: "Festival internacional de teatro em Mindelo (setembro/outubro)" },
                    { date: `${year}-11-01`, name: "Dia de Todos os Santos", desc: "Dia de Todos os Santos" },
                    { date: `${year}-12-25`, name: "Natal", desc: "Dia de Natal — reuniões familiares e comida festiva" },
                    { date: `${year}-12-31`, name: "Réveillon", desc: "Noite de Ano Novo — grande concerto na Rua de Lisboa" }
                ]
            };

            const chEvents = {
                en: [
                    { date: `${year}-01-01`, name: "Nouvel An", desc: "New Year's Day" },
                    { date: `${year}-01-02`, name: "Saint-Berchtold", desc: "Vaud cantonal holiday, unique to Lausanne's region" },
                    { date: fmt(goodFriday), name: "Vendredi Saint", desc: "Good Friday" },
                    { date: fmt(easterMonday), name: "Lundi de Pâques", desc: "Easter Monday — chocolate eggs and family brunches" },
                    { date: fmt(ascension), name: "Ascension", desc: "Ascension Day — a Thursday off, long weekend tradition" },
                    { date: fmt(whitMonday), name: "Lundi de Pentecôte", desc: "Whit Monday" },
                    { date: `${year}-08-01`, name: "Fête nationale", desc: "Swiss National Day — fireworks, bonfires, and fondue" },
                    { date: fmt(federalFast), name: "Lundi du Jeûne fédéral", desc: "Federal Fast Monday — Vaud tradition" },
                    { date: `${year}-12-25`, name: "Noël", desc: "Christmas Day — fondue, raclette, and vin chaud" },
                    { date: `${year}-02-01`, name: "Prix de Lausanne", desc: "Prestigious international ballet competition for young dancers (early February)" },
                    { date: `${year}-04-27`, name: "BDFIL", desc: "Lausanne International Comics Festival — two weeks in the train station quarter" },
                    { date: `${year}-05-01`, name: "Balélec", desc: "EPFL's massive open-air student festival — one of the largest in Europe" },
                    { date: `${year}-05-23`, name: "Caves Ouvertes Vaudoises", desc: "200+ Vaud winemakers open their doors — Chasselas tastings across Lavaux" },
                    { date: `${year}-06-21`, name: "Fête de la Musique", desc: "Free city-wide music festival — stages pop up across Lausanne" },
                    { date: `${year}-06-30`, name: "Festival de la Cité", desc: "Free multi-arts festival — theatre, dance, music in Lausanne's old town (early July)" },
                    { date: `${year}-07-04`, name: "Montreux Jazz Festival", desc: "Legendary two-week jazz & music festival on Lake Geneva (mid-July)" },
                    { date: `${year}-07-21`, name: "Paléo Festival Nyon", desc: "Switzerland's biggest open-air festival — 230,000 spectators over 6 days" },
                    { date: `${year}-08-21`, name: "Athletissima", desc: "Diamond League athletics meeting at the Olympic Stadium" },
                    { date: `${year}-09-26`, name: "Vendanges in Lavaux", desc: "Wine harvest season — vineyard experiences in the UNESCO Lavaux terraces" },
                    { date: `${year}-10-14`, name: "LUFF", desc: "Lausanne Underground Film & Music Festival — avant-garde cinema and sound" },
                    { date: `${year}-10-25`, name: "Lausanne Marathon", desc: "Scenic marathon along Lake Geneva — from Place de Milan to Ouchy" },
                    { date: `${year}-11-20`, name: "Bô Noël", desc: "Lausanne's Christmas markets, light installations, and festive events until Dec 31" },
                    { date: `${year}-12-05`, name: "Les Urbaines", desc: "Free festival of artistic experimentation — sound, visual, and performing arts" }
                ],
                fr: [
                    { date: `${year}-01-01`, name: "Nouvel An", desc: "Jour de l'An" },
                    { date: `${year}-01-02`, name: "Saint-Berchtold", desc: "Jour férié cantonal vaudois, unique à la région de Lausanne" },
                    { date: fmt(goodFriday), name: "Vendredi Saint", desc: "Vendredi Saint" },
                    { date: fmt(easterMonday), name: "Lundi de Pâques", desc: "Lundi de Pâques — œufs en chocolat et brunchs en famille" },
                    { date: fmt(ascension), name: "Ascension", desc: "Jour de l'Ascension — un jeudi de congé, tradition du long week-end" },
                    { date: fmt(whitMonday), name: "Lundi de Pentecôte", desc: "Lundi de Pentecôte" },
                    { date: `${year}-08-01`, name: "Fête nationale", desc: "Fête nationale suisse — feux d'artifice, feux de joie et fondue" },
                    { date: fmt(federalFast), name: "Lundi du Jeûne fédéral", desc: "Lundi du Jeûne fédéral — tradition vaudoise" },
                    { date: `${year}-12-25`, name: "Noël", desc: "Noël — fondue, raclette et vin chaud" },
                    { date: `${year}-02-01`, name: "Prix de Lausanne", desc: "Prestigieux concours international de ballet pour jeunes danseurs (début février)" },
                    { date: `${year}-04-27`, name: "BDFIL", desc: "Festival international de la bande dessinée de Lausanne — deux semaines au quartier de la gare" },
                    { date: `${year}-05-01`, name: "Balélec", desc: "Le grand festival en plein air de l'EPFL — l'un des plus grands d'Europe" },
                    { date: `${year}-05-23`, name: "Caves Ouvertes Vaudoises", desc: "Plus de 200 vignerons vaudois ouvrent leurs portes — dégustations de Chasselas à travers Lavaux" },
                    { date: `${year}-06-21`, name: "Fête de la Musique", desc: "Festival de musique gratuit dans toute la ville — scènes partout dans Lausanne" },
                    { date: `${year}-06-30`, name: "Festival de la Cité", desc: "Festival multi-arts gratuit — théâtre, danse, musique dans la vieille ville (début juillet)" },
                    { date: `${year}-07-04`, name: "Montreux Jazz Festival", desc: "Légendaire festival de jazz et musique de deux semaines au bord du lac Léman (mi-juillet)" },
                    { date: `${year}-07-21`, name: "Paléo Festival Nyon", desc: "Le plus grand festival en plein air de Suisse — 230 000 spectateurs sur 6 jours" },
                    { date: `${year}-08-21`, name: "Athletissima", desc: "Meeting d'athlétisme Diamond League au stade Olympique" },
                    { date: `${year}-09-26`, name: "Vendanges à Lavaux", desc: "Saison des vendanges — expériences viticoles dans les terrasses UNESCO de Lavaux" },
                    { date: `${year}-10-14`, name: "LUFF", desc: "Lausanne Underground Film & Music Festival — cinéma et son avant-gardistes" },
                    { date: `${year}-10-25`, name: "Marathon de Lausanne", desc: "Marathon panoramique le long du lac Léman — de la Place de Milan à Ouchy" },
                    { date: `${year}-11-20`, name: "Bô Noël", desc: "Marchés de Noël de Lausanne, illuminations et événements festifs jusqu'au 31 décembre" },
                    { date: `${year}-12-05`, name: "Les Urbaines", desc: "Festival gratuit d'expérimentation artistique — son, arts visuels et spectacle vivant" }
                ],
                pt: [
                    { date: `${year}-01-01`, name: "Nouvel An", desc: "Dia de Ano Novo" },
                    { date: `${year}-01-02`, name: "Saint-Berchtold", desc: "Feriado cantonal de Vaud, único da região de Lausanne" },
                    { date: fmt(goodFriday), name: "Vendredi Saint", desc: "Sexta-feira Santa" },
                    { date: fmt(easterMonday), name: "Lundi de Pâques", desc: "Segunda-feira de Páscoa — ovos de chocolate e brunches em família" },
                    { date: fmt(ascension), name: "Ascension", desc: "Dia da Ascensão — uma quinta-feira de folga, tradição de fim de semana prolongado" },
                    { date: fmt(whitMonday), name: "Lundi de Pentecôte", desc: "Segunda-feira de Pentecostes" },
                    { date: `${year}-08-01`, name: "Fête nationale", desc: "Dia Nacional da Suíça — fogo de artifício, fogueiras e fondue" },
                    { date: fmt(federalFast), name: "Lundi du Jeûne fédéral", desc: "Segunda-feira do Jejum Federal — tradição de Vaud" },
                    { date: `${year}-12-25`, name: "Noël", desc: "Natal — fondue, raclette e vinho quente" },
                    { date: `${year}-02-01`, name: "Prix de Lausanne", desc: "Prestigiosa competição internacional de ballet para jovens bailarinos (início de fevereiro)" },
                    { date: `${year}-04-27`, name: "BDFIL", desc: "Festival Internacional de Banda Desenhada de Lausanne — duas semanas no bairro da estação" },
                    { date: `${year}-05-01`, name: "Balélec", desc: "O grande festival ao ar livre da EPFL — um dos maiores da Europa" },
                    { date: `${year}-05-23`, name: "Caves Ouvertes Vaudoises", desc: "Mais de 200 viticultores de Vaud abrem as suas portas — provas de Chasselas em Lavaux" },
                    { date: `${year}-06-21`, name: "Fête de la Musique", desc: "Festival de música gratuito por toda a cidade — palcos espalhados por Lausanne" },
                    { date: `${year}-06-30`, name: "Festival de la Cité", desc: "Festival multiartístico gratuito — teatro, dança, música na cidade velha (início de julho)" },
                    { date: `${year}-07-04`, name: "Montreux Jazz Festival", desc: "Lendário festival de jazz e música de duas semanas no Lago Léman (meados de julho)" },
                    { date: `${year}-07-21`, name: "Paléo Festival Nyon", desc: "O maior festival ao ar livre da Suíça — 230 000 espectadores em 6 dias" },
                    { date: `${year}-08-21`, name: "Athletissima", desc: "Meeting de atletismo Diamond League no Estádio Olímpico" },
                    { date: `${year}-09-26`, name: "Vendanges in Lavaux", desc: "Época das vindimas — experiências vinícolas nos terraços UNESCO de Lavaux" },
                    { date: `${year}-10-14`, name: "LUFF", desc: "Lausanne Underground Film & Music Festival — cinema e som de vanguarda" },
                    { date: `${year}-10-25`, name: "Marathon de Lausanne", desc: "Maratona panorâmica ao longo do Lago Léman — da Place de Milan a Ouchy" },
                    { date: `${year}-11-20`, name: "Bô Noël", desc: "Mercados de Natal de Lausanne, instalações de luz e eventos festivos até 31 de dezembro" },
                    { date: `${year}-12-05`, name: "Les Urbaines", desc: "Festival gratuito de experimentação artística — som, artes visuais e artes performativas" }
                ]
            };

            return { cvEvents: cvEvents[currentLang], chEvents: chEvents[currentLang] };
        }

        // ---- Language Switcher ----
        function setLanguage(lang) {
            currentLang = lang;
            localStorage.setItem('timeBridgeLang', lang);
            document.documentElement.lang = lang;

            // Update active button
            document.querySelectorAll('.lang-btn').forEach(btn => {
                btn.classList.toggle('active', btn.textContent === lang.toUpperCase());
            });

            // Update static text elements
            const staticKeys = [
                'subtitle', 'locationCv', 'locationCh',
                'happeningLabelCv', 'happeningLabelCh',
                'callTitle', 'callSubtitle', 'callHoursCvLabel', 'callHoursChLabel',
                'aiTitle', 'aiSubtitle',
                'weatherTitle', 'weatherSubtitle', 'weatherCvTitle', 'weatherChTitle',
                'sunTitle', 'sunSubtitle', 'sunCvTitle', 'sunChTitle',
                'calendarTitle', 'calendarSubtitle',
                'mediaTitle', 'mediaSubtitle', 'mediaCvTitle', 'mediaChTitle',
                'neuroTitle', 'footerText'
            ];
            staticKeys.forEach(key => {
                const el = document.getElementById(key);
                if (el && T[key]) {
                    el.textContent = T[key][lang];
                }
            });

            // Update data-i18n elements (media type labels)
            document.querySelectorAll('[data-i18n]').forEach(el => {
                const key = el.getAttribute('data-i18n');
                if (T[key]) el.textContent = T[key][lang];
            });

            // Update time diff text
            document.getElementById('timeDiffPrefix').textContent = T.timeDiffPrefix[lang];
            document.getElementById('timeDiffSuffix').textContent = T.timeDiffSuffix[lang];
            document.getElementById('workHoursCv').textContent = T.callHoursCvValue[lang];
            document.getElementById('workHoursCh').textContent = T.callHoursChValue[lang];
            updateAiStaticText();
            updateAiLogButtonText();

            // Re-render dynamic sections
            updateClocks();
            updateHappening(new Date());
            renderCalendar();
            renderNeuroTip();
            refreshWeatherMeta();
            initAiInsight();
            // Re-fetch weather to re-render with correct language
            fetchWeather();
        }

        // Make setLanguage global for onclick handlers
        window.setLanguage = setLanguage;

        // ---- Clock & Time ----
        function updateClocks() {
            const now = new Date();
            const locale = LOCALES[currentLang];

            // Mindelo time
            const cvOptions = { timeZone: MINDELO_TZ };
            const cvTime = now.toLocaleTimeString('en-GB', { ...cvOptions, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
            const cvDate = now.toLocaleDateString(locale, { ...cvOptions, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
            const cvParts = cvTime.split(':');
            document.getElementById('timeMindelo').innerHTML =
                cvParts[0] + ':' + cvParts[1] + '<span class="clock-seconds">:' + cvParts[2] + '</span>';
            document.getElementById('dateMindelo').textContent = cvDate;

            // Lausanne time
            const chOptions = { timeZone: LAUSANNE_TZ };
            const chTime = now.toLocaleTimeString('en-GB', { ...chOptions, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
            const chDate = now.toLocaleDateString(locale, { ...chOptions, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
            const chParts = chTime.split(':');
            document.getElementById('timeLausanne').innerHTML =
                chParts[0] + ':' + chParts[1] + '<span class="clock-seconds">:' + chParts[2] + '</span>';
            document.getElementById('dateLausanne').textContent = chDate;

            // Calculate time difference
            const cvOffset = getTimezoneOffset(now, MINDELO_TZ);
            const chOffset = getTimezoneOffset(now, LAUSANNE_TZ);
            const diffHours = (chOffset - cvOffset) / 60;
            const hourWord = diffHours !== 1 ? T.hours[currentLang] : T.hour[currentLang];
            document.getElementById('timeDiff').textContent = diffHours + ' ' + hourWord;

            // Update timezone labels
            const isDST = isSwissDST(now, LAUSANNE_TZ);
            document.getElementById('tzLausanne').textContent = isDST ? 'CEST (UTC+2)' : 'CET (UTC+1)';
            document.getElementById('tzMindelo').textContent = 'CVT (UTC−1)';

            updateHappening(now);
            updateBestTimeToCall(now);
            refreshWeatherMeta();
        }

        // ---- Call overlap ----

        function formatTimeInTZ(date, tz) {
            return date.toLocaleTimeString(LOCALES[currentLang], {
                timeZone: tz,
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            });
        }

        function formatOverlapWindow(window) {
            const chStart = formatTimeInTZ(window.start, LAUSANNE_TZ);
            const chEnd = formatTimeInTZ(window.end, LAUSANNE_TZ);
            const cvStart = formatTimeInTZ(window.start, MINDELO_TZ);
            const cvEnd = formatTimeInTZ(window.end, MINDELO_TZ);
            return `${chStart}-${chEnd} ${T.callWindowPrefix[currentLang]} · ${cvStart}-${cvEnd} ${T.callWindowSuffix[currentLang]}`;
        }

        function formatDayTimeInTZ(date, tz) {
            return date.toLocaleString(LOCALES[currentLang], {
                timeZone: tz,
                weekday: 'short',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            });
        }

        function updateBestTimeToCall(now) {
            const windows = getOverlapWindows(now, { mindeloTz: MINDELO_TZ, lausanneTz: LAUSANNE_TZ });
            const currentWindow = windows.find(w => now >= w.start && now < w.end);
            const nextWindow = windows.find(w => w.start > now);
            const statusEl = document.getElementById('callStatus');
            const nextEl = document.getElementById('callNext');

            if (currentWindow) {
                statusEl.textContent = T.callStatusNow[currentLang];
                nextEl.textContent = `${T.callUntil[currentLang]} ${formatTimeInTZ(currentWindow.end, LAUSANNE_TZ)} ${T.callWindowPrefix[currentLang]} · ${formatTimeInTZ(currentWindow.end, MINDELO_TZ)} ${T.callWindowSuffix[currentLang]}`;
                return;
            }

            if (nextWindow) {
                statusEl.textContent = T.callStatusLater[currentLang];
                nextEl.textContent = `${T.callStatusNextStarts[currentLang]} ${formatDayTimeInTZ(nextWindow.start, LAUSANNE_TZ)} ${T.callWindowPrefix[currentLang]} · ${formatDayTimeInTZ(nextWindow.start, MINDELO_TZ)} ${T.callWindowSuffix[currentLang]}`;
                return;
            }

            statusEl.textContent = T.callStatusNone[currentLang];
            nextEl.textContent = T.callNoWindow[currentLang];
        }

        // ---- AI Insight ----
        function getTodayKey() {
            return new Date().toISOString().slice(0, 10);
        }

        function getAiCacheEntryKey(day, lang) {
            return `${day}:${lang}`;
        }

        function loadAiDailyCache() {
            try {
                const raw = localStorage.getItem(AI_DAILY_CACHE_KEY);
                return raw ? JSON.parse(raw) : {};
            } catch (err) {
                return {};
            }
        }

        function saveAiDailyCache() {
            try {
                localStorage.setItem(AI_DAILY_CACHE_KEY, JSON.stringify(aiDailyCache));
            } catch (err) {
                // Ignore storage errors. Network fetch remains source of truth.
            }
        }

        function getCachedAiDailyContent(day, lang) {
            const entry = aiDailyCache[getAiCacheEntryKey(day, lang)];
            return entry && entry.content ? entry.content : null;
        }

        function setCachedAiDailyContent(day, lang, content) {
            aiDailyCache[getAiCacheEntryKey(day, lang)] = {
                savedAt: Date.now(),
                content
            };
            saveAiDailyCache();
        }

        function loadMessageLog() {
            try {
                const raw = localStorage.getItem(MESSAGE_LOG_KEY);
                const parsed = raw ? JSON.parse(raw) : [];
                return Array.isArray(parsed) ? parsed : [];
            } catch (err) {
                return [];
            }
        }

        function saveMessageLog() {
            try {
                localStorage.setItem(MESSAGE_LOG_KEY, JSON.stringify(messageLog));
            } catch (err) {
                // Ignore storage failures.
            }
        }

        function downloadMessageLog() {
            const exportPayload = {
                exportedAt: new Date().toISOString(),
                entries: messageLog
            };
            const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `time-bridge-message-log-${getTodayKey()}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);
        }

        function updateAiLogButtonText() {
            const btn = document.getElementById('aiLogDownloadBtn');
            if (!btn) return;
            btn.textContent = T.aiLogDownload[currentLang];
        }

        function renderAiDisclaimer(text) {
            const subtitle = document.getElementById('aiSubtitle');
            if (subtitle) subtitle.textContent = T.aiDisclaimerFallback[currentLang];

            const disclaimer = document.getElementById('aiDisclaimer');
            if (disclaimer) disclaimer.textContent = T.aiDisclaimerFallback[currentLang];
        }

        function buildLegacyAiContent(payload) {
            if (!payload || typeof payload.insight !== 'string' || !payload.insight.trim()) return null;
            return {
                insight: payload.insight.trim(),
                disclaimer: T.aiDisclaimerFallback.en,
                facts: { common: '', mindelo: '', lausanne: '' },
                themes: null
            };
        }

        function formatInsightText(content) {
            const facts = [];
            if (content?.facts?.common) facts.push(content.facts.common);
            if (content?.facts?.mindelo) facts.push(content.facts.mindelo);
            if (content?.facts?.lausanne) facts.push(content.facts.lausanne);
            if (!facts.length) return content.insight;
            return `${content.insight}\n\n• ${facts.join('\n• ')}`;
        }

        function applyAiDailyContent(content, options = {}) {
            const { persist = false, day = getTodayKey(), lang = currentLang } = options;
            const normalized = normalizeAiDailyContent(content);
            const finalContent = normalized || buildLegacyAiContent(content);
            if (!finalContent) return false;

            aiDailyContent = finalContent;
            aiHappeningOverrides = normalized && normalized.themes
                ? buildAiHappeningOverrides(normalized.themes)
                : null;
            aiHasGenerated = true;

            const output = document.getElementById('aiOutput');
            const status = document.getElementById('aiStatus');
            if (output) output.textContent = formatInsightText(finalContent);
            if (status) status.textContent = T.aiStatusReady[currentLang];
            renderAiDisclaimer(finalContent.disclaimer);
            updateHappening(new Date());

            if (persist) setCachedAiDailyContent(day, lang, finalContent);
            return true;
        }

        function updateAiStaticText() {
            const status = document.getElementById('aiStatus');
            const output = document.getElementById('aiOutput');
            if (!status || !output) return;

            if (!aiHasGenerated) {
                output.textContent = T.aiOutputPlaceholder[currentLang];
                renderAiDisclaimer(T.aiDisclaimerFallback[currentLang]);
            }
            status.textContent = AI_ENDPOINT ? T.aiStatusLoading[currentLang] : T.aiStatusNotConfigured[currentLang];
        }

        function buildAiContextPayload() {
            return {
                lang: currentLang,
                generatedAt: new Date().toISOString(),
                cities: ['Mindelo', 'Lausanne'],
                timeDifference: document.getElementById('timeDiff').textContent,
                callStatus: document.getElementById('callStatus').textContent,
                happeningMindelo: document.getElementById('happeningCv').textContent,
                happeningLausanne: document.getElementById('happeningCh').textContent,
                weatherMindelo: document.getElementById('weatherCvContent').innerText.trim(),
                weatherLausanne: document.getElementById('weatherChContent').innerText.trim(),
                dayLengthInfo: document.getElementById('sunDiff').textContent,
            };
        }

        async function fetchDailyAiInsight() {
            const status = document.getElementById('aiStatus');
            if (!status) return;
            const day = getTodayKey();

            const cached = getCachedAiDailyContent(day, currentLang);
            if (cached) {
                applyAiDailyContent(cached, { persist: false, day, lang: currentLang });
                return;
            }

            if (!AI_ENDPOINT) {
                status.textContent = T.aiStatusNotConfigured[currentLang];
                return;
            }

            status.textContent = T.aiStatusLoading[currentLang];
            try {
                const res = await fetch(AI_ENDPOINT, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(buildAiContextPayload()),
                });
                if (!res.ok) throw new Error('HTTP ' + res.status);
                const data = await res.json();
                const didApply = applyAiDailyContent(data, { persist: true, day, lang: currentLang });
                if (!didApply) throw new Error('No insight in response');
            } catch (err) {
                status.textContent = T.aiStatusRetryLater[currentLang];
                if (!aiHasGenerated) {
                    const output = document.getElementById('aiOutput');
                    if (output) output.textContent = T.aiOutputPlaceholder[currentLang];
                }
            }
        }

        function initAiInsight() {
            const logBtn = document.getElementById('aiLogDownloadBtn');
            if (logBtn && !logBtn.dataset.bound) {
                logBtn.addEventListener('click', downloadMessageLog);
                logBtn.dataset.bound = '1';
            }
            updateAiLogButtonText();

            const day = getTodayKey();
            const cached = getCachedAiDailyContent(day, currentLang);
            aiHasGenerated = false;
            aiDailyContent = null;
            aiHappeningOverrides = null;
            if (cached) {
                applyAiDailyContent(cached, { persist: false, day, lang: currentLang });
                return;
            }
            updateAiStaticText();
            fetchDailyAiInsight();
        }

        // ---- What's Happening Now ----
        function getHappeningSourceList(cityKey, dayType) {
            const aiDayType = dayType === 'weekday' ? 'weekday' : 'weekend';
            const aiList = aiHappeningOverrides?.[aiDayType]?.[cityKey];
            if (Array.isArray(aiList) && aiList.length) {
                return { list: aiList, source: 'ai' };
            }

            if (cityKey === 'cv') {
                if (dayType === 'weekday') return { list: happeningCV[currentLang], source: 'static' };
                return { list: happeningCVWeekend[dayType][currentLang], source: 'static' };
            }

            if (dayType === 'weekday') return { list: happeningCH[currentLang], source: 'static' };
            return { list: happeningCHWeekend[dayType][currentLang], source: 'static' };
        }

        function recordMessageDisplay(cityKey, scene, dayType, source) {
            if (!scene || !scene.text) return;
            const lastEntry = lastDisplayedByCity[cityKey];
            if (!shouldRecordMessage(lastEntry, scene.text)) return;

            lastDisplayedByCity[cityKey] = { text: scene.text };
            messageLog = appendMessageLog(messageLog, createMessageLogEntry({
                city: cityKey,
                dayType,
                source,
                text: scene.text,
                isoNow: new Date().toISOString(),
            }));
            saveMessageLog();
        }

        function updateHappening(now) {
            const cvDayType = getDayTypeInTZ(now, MINDELO_TZ);
            const chDayType = getDayTypeInTZ(now, LAUSANNE_TZ);
            const cvHour = getHourInTZ(now, MINDELO_TZ);
            const chHour = getHourInTZ(now, LAUSANNE_TZ);
            const cvSourceList = getHappeningSourceList('cv', cvDayType);
            const chSourceList = getHappeningSourceList('ch', chDayType);

            const cvScene = selectSceneByHour(cvSourceList.list, cvHour);
            const chScene = selectSceneByHour(chSourceList.list, chHour);

            document.getElementById('happeningCvEmoji').textContent = cvScene.emoji;
            document.getElementById('happeningCv').textContent = cvScene.text;
            document.getElementById('happeningChEmoji').textContent = chScene.emoji;
            document.getElementById('happeningCh').textContent = chScene.text;

            recordMessageDisplay('cv', cvScene, cvDayType, cvSourceList.source);
            recordMessageDisplay('ch', chScene, chDayType, chSourceList.source);
        }

        // ---- Weather (Open-Meteo — free, no API key needed) ----
        const WEATHER_CACHE_KEY = 'timeBridgeWeatherCacheV1';
        const WEATHER_META_IDS = { cv: 'weatherCvMeta', ch: 'weatherChMeta' };
        let weatherCache = loadWeatherCache();
        const weatherMeta = {
            cv: null,
            ch: null
        };

        function loadWeatherCache() {
            try {
                const raw = localStorage.getItem(WEATHER_CACHE_KEY);
                return raw ? JSON.parse(raw) : {};
            } catch (err) {
                return {};
            }
        }

        function saveWeatherCache() {
            try {
                localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify(weatherCache));
            } catch (err) {
                // Ignore storage failures (quota/private mode), live fetch still works.
            }
        }

        function formatUpdatedAgo(timestamp) {
            if (!timestamp) return '--';
            const diffMin = Math.floor((Date.now() - timestamp) / 60000);
            if (diffMin <= 0) {
                return `${T.updatedLabel[currentLang]}: ${T.updatedJustNow[currentLang]}`;
            }
            const agoPart = T.ago[currentLang] ? ` ${T.ago[currentLang]}` : '';
            return `${T.updatedLabel[currentLang]}: ${diffMin} ${diffMin === 1 ? T.minute[currentLang] : T.minutes[currentLang]}${agoPart}`;
        }

        function refreshWeatherMeta() {
            Object.keys(WEATHER_META_IDS).forEach(key => {
                const el = document.getElementById(WEATHER_META_IDS[key]);
                if (!el) return;
                const meta = weatherMeta[key];
                if (!meta) {
                    el.textContent = `${T.updatedLabel[currentLang]}: --`;
                    return;
                }
                if (meta.messageKey && T[meta.messageKey]) {
                    el.textContent = T[meta.messageKey][currentLang];
                    return;
                }
                let text = formatUpdatedAgo(meta.fetchedAt);
                if (meta.source === 'cache') {
                    text += ` · ${T.usingCachedData[currentLang]}`;
                    if (meta.offline) text += ` · ${T.offlineMode[currentLang]}`;
                }
                el.textContent = text;
            });
        }

        const WMO_EMOJIS = {
            0: '☀️', 1: '🌤️', 2: '⛅', 3: '☁️',
            45: '🌫️', 48: '🌫️',
            51: '🌦️', 53: '🌦️', 55: '🌧️',
            61: '🌧️', 63: '🌧️', 65: '🌧️',
            71: '🌨️', 73: '🌨️', 75: '❄️', 77: '❄️',
            80: '🌦️', 81: '🌧️', 82: '🌧️',
            85: '🌨️', 86: '❄️',
            95: '⛈️', 96: '⛈️', 99: '⛈️'
        };

        function getWmoDesc(code) {
            const key = 'wmo' + code;
            return T[key] ? T[key][currentLang] : 'Unknown';
        }

        function renderWeather(containerId, current) {
            const code = current.weather_code;
            const emoji = WMO_EMOJIS[code] || '🌡️';
            const desc = getWmoDesc(code);
            const temp = Math.round(current.temperature_2m);
            const feelsLike = Math.round(current.apparent_temperature);
            const humidity = current.relative_humidity_2m;
            const wind = Math.round(current.wind_speed_10m);

            document.getElementById(containerId).innerHTML = `
                <div class="weather-icon">${emoji}</div>
                <div class="weather-temp">${temp}°C</div>
                <div class="weather-desc">${desc}</div>
                <div class="weather-details">
                    <span>🌡️ ${T.feelsLike[currentLang]} ${feelsLike}°</span>
                    <span>💧 ${humidity}%</span>
                    <span>💨 ${wind} km/h</span>
                </div>
            `;
        }

        function renderWeatherError(containerId, msg) {
            document.getElementById(containerId).innerHTML =
                `<div class="weather-error">${msg}</div>`;
        }

        function formatHHMMFromIso(isoString) {
            if (!isoString || !isoString.includes('T')) return '--:--';
            return isoString.split('T')[1].slice(0, 5);
        }

        function formatDayLength(seconds) {
            if (typeof seconds !== 'number' || Number.isNaN(seconds)) return '--';
            const totalMinutes = Math.floor(seconds / 60);
            const hours = Math.floor(totalMinutes / 60);
            const minutes = totalMinutes % 60;
            return `${hours}h ${minutes}m`;
        }

        function renderSun(containerId, daily) {
            const sunrise = formatHHMMFromIso(daily.sunrise && daily.sunrise[0]);
            const sunset = formatHHMMFromIso(daily.sunset && daily.sunset[0]);
            const dayLength = formatDayLength(daily.daylight_duration && daily.daylight_duration[0]);

            document.getElementById(containerId).innerHTML = `
                <div class="sun-grid">
                    <div class="sun-metric">
                        <div class="sun-metric-label">${T.sunrise[currentLang]}</div>
                        <div class="sun-metric-value">${sunrise}</div>
                    </div>
                    <div class="sun-metric">
                        <div class="sun-metric-label">${T.sunset[currentLang]}</div>
                        <div class="sun-metric-value">${sunset}</div>
                    </div>
                    <div class="sun-metric">
                        <div class="sun-metric-label">${T.dayLength[currentLang]}</div>
                        <div class="sun-metric-value">${dayLength}</div>
                    </div>
                </div>
            `;
        }

        function renderSunError(containerId, msg) {
            document.getElementById(containerId).innerHTML =
                `<div class="weather-error">${msg}</div>`;
        }

        function renderSunDiff(cvDaylight, chDaylight) {
            const diffEl = document.getElementById('sunDiff');
            if (typeof cvDaylight !== 'number' || typeof chDaylight !== 'number') {
                diffEl.textContent = T.sunDataUnavailable[currentLang];
                return;
            }

            const diffSeconds = Math.abs(chDaylight - cvDaylight);
            if (diffSeconds < 60) {
                diffEl.textContent = T.daylightSame[currentLang];
                return;
            }

            const city = chDaylight > cvDaylight ? T.cityLausanne[currentLang] : T.cityMindelo[currentLang];
            diffEl.textContent = `${T.daylightDiffPrefix[currentLang]}: ${formatDayLength(diffSeconds)} ${T.daylightLongerIn[currentLang]} ${city}`;
        }

        async function fetchWeather() {
            const cities = [
                { key: 'cv', lat: 16.89, lon: -24.98, tz: 'Atlantic/Cape_Verde', weatherContainer: 'weatherCvContent', sunContainer: 'sunCvContent' },
                { key: 'ch', lat: 46.52, lon: 6.63, tz: 'Europe/Zurich', weatherContainer: 'weatherChContent', sunContainer: 'sunChContent' }
            ];
            const daylightByCity = { cv: null, ch: null };

            function renderFromPayload(city, payload) {
                renderWeather(city.weatherContainer, payload.current);
                if (payload.daily && payload.daily.sunrise && payload.daily.sunset && payload.daily.daylight_duration) {
                    renderSun(city.sunContainer, payload.daily);
                    daylightByCity[city.key] = payload.daily.daylight_duration[0];
                } else {
                    renderSunError(city.sunContainer, T.sunDataUnavailable[currentLang]);
                }
            }

            for (const city of cities) {
                try {
                    const params = [
                        `latitude=${city.lat}`,
                        `longitude=${city.lon}`,
                        'current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m',
                        'daily=sunrise,sunset,daylight_duration',
                        `timezone=${encodeURIComponent(city.tz)}`
                    ].join('&');
                    const url = `https://api.open-meteo.com/v1/forecast?${params}`;
                    const res = await fetch(url);
                    if (!res.ok) {
                        throw new Error('HTTP ' + res.status);
                    }
                    const data = await res.json();
                    renderFromPayload(city, data);

                    const fetchedAt = Date.now();
                    weatherCache[city.key] = { payload: data, fetchedAt };
                    weatherMeta[city.key] = { fetchedAt, source: 'live', offline: false };
                } catch (err) {
                    const cached = weatherCache[city.key];
                    if (cached && cached.payload) {
                        renderFromPayload(city, cached.payload);
                        weatherMeta[city.key] = {
                            fetchedAt: cached.fetchedAt || Date.now(),
                            source: 'cache',
                            offline: !navigator.onLine
                        };
                    } else {
                        renderWeatherError(city.weatherContainer, T.weatherFetchError[currentLang]);
                        renderSunError(city.sunContainer, T.sunDataUnavailable[currentLang]);
                        weatherMeta[city.key] = { messageKey: 'weatherNoData' };
                    }
                }
            }
            saveWeatherCache();
            renderSunDiff(daylightByCity.cv, daylightByCity.ch);
            refreshWeatherMeta();
        }

        // ---- Cultural Calendar helpers ----
        function getEasterDate(year) {
            const a = year % 19;
            const b = Math.floor(year / 100);
            const c = year % 100;
            const d = Math.floor(b / 4);
            const e = b % 4;
            const f = Math.floor((b + 8) / 25);
            const g = Math.floor((b - f + 1) / 3);
            const h = (19 * a + b - d - g + 15) % 30;
            const i = Math.floor(c / 4);
            const k = c % 4;
            const l = (32 + 2 * e + 2 * i - h - k) % 7;
            const m = Math.floor((a + 11 * h + 22 * l) / 451);
            const month = Math.floor((h + l - 7 * m + 114) / 31);
            const day = ((h + l - 7 * m + 114) % 31) + 1;
            return new Date(year, month - 1, day);
        }

        function addDays(date, days) {
            const d = new Date(date);
            d.setDate(d.getDate() + days);
            return d;
        }

        function fmt(date) {
            const y = date.getFullYear();
            const m = String(date.getMonth() + 1).padStart(2, '0');
            const d = String(date.getDate()).padStart(2, '0');
            return `${y}-${m}-${d}`;
        }

        function getFederalFastMonday(year) {
            let d = new Date(year, 8, 1);
            const dayOfWeek = d.getDay();
            const firstSunday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
            const thirdSunday = firstSunday + 14;
            return new Date(year, 8, thirdSunday + 1);
        }

        function renderCalendar() {
            const { cvEvents, chEvents } = getCulturalEvents();
            const now = new Date();
            now.setHours(0, 0, 0, 0);
            const locale = LOCALES[currentLang];

            function renderEvents(events, containerId, flag, title) {
                const sorted = events
                    .map(e => ({ ...e, dateObj: new Date(e.date + 'T00:00:00') }))
                    .sort((a, b) => a.dateObj - b.dateObj);

                const upcoming = sorted.filter(e => e.dateObj >= now);
                const past = sorted.filter(e => e.dateObj < now);
                const nextUp = upcoming[0];
                const rest = [...upcoming.slice(1), ...past];
                const listId = containerId + 'List';

                function eventHTML(e, isPast) {
                    const dateStr = e.dateObj.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
                    return `
                        <div class="event-item ${isPast ? 'event-past' : ''}">
                            <div class="event-date">${dateStr}</div>
                            <div class="event-info">
                                <div class="event-name">${e.name}</div>
                                <div class="event-desc">${e.desc}</div>
                            </div>
                        </div>`;
                }

                const nextUpHTML = nextUp ? `
                    <div class="calendar-next">
                        <div class="event-date">${nextUp.dateObj.toLocaleDateString(locale, { day: 'numeric', month: 'short' })}</div>
                        <div class="event-info">
                            <div class="next-label">${T.nextUp[currentLang]}</div>
                            <div class="event-name">${nextUp.name}</div>
                            <div class="event-desc">${nextUp.desc}</div>
                        </div>
                    </div>` : '';

                const html = `
                    <div class="calendar-header">
                        <h3>${flag} ${title}</h3>
                        <span class="event-count">${sorted.length} ${T.events[currentLang]}</span>
                    </div>
                    ${nextUpHTML}
                    <div class="calendar-list-wrapper">
                        <div class="calendar-list" id="${listId}">
                            ${rest.map(e => eventHTML(e, e.dateObj < now)).join('')}
                        </div>
                        <div class="calendar-fade" id="${listId}Fade"></div>
                    </div>
                `;

                document.getElementById(containerId).innerHTML = html;

                const listEl = document.getElementById(listId);
                const fadeEl = document.getElementById(listId + 'Fade');
                if (listEl && fadeEl) {
                    function checkScroll() {
                        const atBottom = listEl.scrollHeight - listEl.scrollTop - listEl.clientHeight < 10;
                        fadeEl.classList.toggle('hidden', atBottom);
                        if (listEl.scrollHeight <= listEl.clientHeight) {
                            fadeEl.classList.add('hidden');
                        }
                    }
                    listEl.addEventListener('scroll', checkScroll);
                    checkScroll();
                }
            }

            renderEvents(cvEvents, 'calendarCv', '🇨🇻', T.calendarCvTitle[currentLang]);
            renderEvents(chEvents, 'calendarCh', '🇨🇭', T.calendarChTitle[currentLang]);
        }

        // ---- Neuroscience Tips ----
        function renderNeuroTip() {
            const now = new Date();
            const start = new Date(now.getFullYear(), 0, 0);
            const dayOfYear = Math.floor((now - start) / 86400000);
            const tips = neuroTips[currentLang];
            const tipIndex = dayOfYear % tips.length;
            const tip = tips[tipIndex];

            document.getElementById('neuroCategory').textContent = tip.category;
            document.getElementById('neuroEmoji').textContent = tip.emoji;
            document.getElementById('neuroTip').textContent = tip.tip;
            document.getElementById('neuroSource').textContent = tip.source;
        }

        // ---- Initialize ----
        function init() {
            // Apply saved language
            setLanguage(currentLang);

            // Start clock interval
            setInterval(updateClocks, 1000);
            // Refresh weather every 10 minutes
            setInterval(fetchWeather, 600000);
        }

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', init);
        } else {
            init();
        }
    })();
