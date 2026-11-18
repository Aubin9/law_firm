"use client";

import React, { useState, useEffect, useTransition } from "react";
import {
  BookOpen,
  Search,
  Scale,
  Copy,
  Check,
  ExternalLink,
  FolderPlus,
  Bookmark,
  FileText,
  Building2,
  Calendar,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  getLegalTextAction,
  searchLibraryAction,
} from "@/server/actions/library-actions";
import { createNoteAction } from "@/server/actions/task-actions";

interface LegalTextSummary {
  id: string;
  code: string;
  title: string;
  shortTitle: string | null;
  jurisdiction: "CAMEROON" | "OHADA" | "CEMAC" | "INTERNATIONAL";
  category: string;
  status: string;
  gazetteRef: string | null;
  sourceUrl: string | null;
  _count?: { articles: number };
}

interface LegalArticle {
  id: string;
  articleNumber: string;
  orderIndex: number;
  title: string | null;
  content: string;
  status: string;
  keywords: string[];
}

interface MatterOption {
  id: string;
  reference?: string;
  code?: string;
  title: string;
}

interface Props {
  locale: "fr" | "en";
  initialTexts: LegalTextSummary[];
  matters: MatterOption[];
}

export function LibraryClient({ locale, initialTexts, matters }: Props) {
  const [texts] = useState<LegalTextSummary[]>(initialTexts);
  const [selectedTextId, setSelectedTextId] = useState<string>(initialTexts[0]?.id || "");
  const [currentText, setCurrentText] = useState<any | null>(null);
  const [loadingText, setLoadingText] = useState<boolean>(false);

  // Filters & Search
  const [jurisdictionFilter, setJurisdictionFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchResults, setSearchResults] = useState<any[] | null>(null);
  const [isSearching, setIsSearching] = useState<boolean>(false);

  // Copied citation state
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [bannerMsg, setBannerMsg] = useState<string | null>(null);

  // Attach to matter modal state
  const [attachArticle, setAttachArticle] = useState<{
    textTitle: string;
    articleNumber: string;
    content: string;
  } | null>(null);
  const [selectedMatterId, setSelectedMatterId] = useState<string>(matters[0]?.id || "");
  const [isAttaching, setIsAttaching] = useState<boolean>(false);

  // Load selected text details
  useEffect(() => {
    if (!selectedTextId) return;
    setLoadingText(true);
    getLegalTextAction(selectedTextId).then((res) => {
      if (res.success && res.text) {
        setCurrentText(res.text);
      }
      setLoadingText(false);
    });
  }, [selectedTextId]);

  // Handle Search
  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      setSearchResults(null);
      return;
    }

    setIsSearching(true);
    const jFilter = jurisdictionFilter === "ALL" ? undefined : (jurisdictionFilter as any);
    const res = await searchLibraryAction(searchQuery.trim(), jFilter);
    setIsSearching(false);

    if (res.success && res.articles) {
      setSearchResults(res.articles);
    }
  };

  const handleClearSearch = () => {
    setSearchQuery("");
    setSearchResults(null);
  };

  // Copy citation
  const handleCopyCitation = (article: { articleNumber: string; content: string }, textTitle?: string) => {
    const parentTitle = textTitle || currentText?.shortTitle || currentText?.title || "Texte de loi";
    const citation = `« ${article.articleNumber} - ${parentTitle} : ${article.content} »`;

    navigator.clipboard.writeText(citation);
    setCopiedId(article.articleNumber);
    setBannerMsg(locale === "fr" ? "Citation juridique copiée dans le presse-papiers !" : "Citation copied to clipboard!");
    setTimeout(() => {
      setCopiedId(null);
      setBannerMsg(null);
    }, 3000);
  };

  // Attach to matter action
  const handleAttachSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!attachArticle || !selectedMatterId) return;

    setIsAttaching(true);
    const noteText = locale === "fr"
      ? `[Référence juridique liée - ${attachArticle.textTitle} ${attachArticle.articleNumber}] :\n\n${attachArticle.content}`
      : `[Linked Legal Authority - ${attachArticle.textTitle} ${attachArticle.articleNumber}] :\n\n${attachArticle.content}`;

    const res = await createNoteAction(selectedMatterId, noteText, false);
    setIsAttaching(false);

    if (res.success) {
      setBannerMsg(
        locale === "fr"
          ? "Article juridique attaché au dossier sous forme de note de recherche."
          : "Legal article attached to matter file."
      );
      setAttachArticle(null);
      setTimeout(() => setBannerMsg(null), 4000);
    }
  };

  // Filtered texts list
  const filteredTexts = texts.filter((t) => {
    if (jurisdictionFilter === "ALL") return true;
    return t.jurisdiction === jurisdictionFilter;
  });

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-16">
      {/* Page Header */}
      <div className="rounded-xl bg-gradient-to-r from-[#0A192F] via-[#112240] to-[#1E3A8A] text-white p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <BookOpen className="w-6 h-6 text-amber-400" />
              <h1 className="text-xl font-bold tracking-tight">
                {locale === "fr" ? "Bibliothèque Juridique Numérique" : "Digital Legal Library"}
              </h1>
            </div>
            <p className="text-xs text-blue-200 max-w-2xl">
              {locale === "fr"
                ? "Corpus harmonisé : Droit OHADA, Législation camerounaise, Réglementation CEMAC et Modèles internes du cabinet."
                : "Harmonized Corpus: OHADA Law, Cameroon Statutes, CEMAC Regulations, and Internal Firm Precedents."}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Badge className="bg-amber-400/20 text-amber-300 border-amber-400/30 text-xs">
              Loi n° 2024/017 &amp; OHADA 2024
            </Badge>
          </div>
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearchSubmit} className="mt-5 flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                locale === "fr"
                  ? "Rechercher un article, un mot-clé ou un concept (ex: injonction, secret professionnel, bail, abus de confiance)..."
                  : "Search an article, keyword, or concept (e.g. debt collection, legal privilege, commercial lease)..."
              }
              className="w-full text-xs rounded-lg pl-9 pr-9 py-2 bg-white/10 text-white placeholder-blue-200/60 border border-white/20 focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="absolute right-2.5 top-2.5 text-blue-200 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <Button
            type="submit"
            disabled={isSearching}
            className="text-xs bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold"
          >
            {isSearching
              ? locale === "fr"
                ? "Recherche..."
                : "Searching..."
              : locale === "fr"
              ? "Rechercher"
              : "Search"}
          </Button>
        </form>
      </div>

      {bannerMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-lg text-xs font-medium flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{bannerMsg}</span>
        </div>
      )}

      {/* Jurisdiction Filters */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
        {[
          { key: "ALL", labelFr: "Tous les corpus", labelEn: "All texts" },
          { key: "OHADA", labelFr: "Actes Uniformes OHADA", labelEn: "OHADA Uniform Acts" },
          { key: "CAMEROON", labelFr: "Législation Cameroun", labelEn: "Cameroon Statutes" },
          { key: "CEMAC", labelFr: "Réglementation CEMAC / COBAC", labelEn: "CEMAC / COBAC" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setJurisdictionFilter(tab.key)}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
              jurisdictionFilter === tab.key
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted/60 text-muted-foreground hover:text-foreground"
            }`}
          >
            {locale === "fr" ? tab.labelFr : tab.labelEn}
          </button>
        ))}
      </div>

      {/* SEARCH RESULTS VIEW */}
      {searchResults ? (
        <div className="bg-white rounded-xl border border-border p-6 shadow-sm space-y-4 dark:bg-card">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-primary">
              {locale === "fr"
                ? `Résultats de recherche pour « ${searchQuery} » (${searchResults.length} articles trouvés)`
                : `Search results for "${searchQuery}" (${searchResults.length} articles found)`}
            </h2>
            <Button variant="outline" size="sm" onClick={handleClearSearch} className="text-xs">
              {locale === "fr" ? "Retour aux codes" : "Back to codes"}
            </Button>
          </div>

          {searchResults.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              {locale === "fr"
                ? "Aucun article juridique ne correspond à votre recherche."
                : "No legal articles found matching your query."}
            </div>
          ) : (
            <div className="space-y-4">
              {searchResults.map((article) => (
                <div
                  key={article.id}
                  className="rounded-lg border border-border p-4 bg-muted/20 space-y-2 hover:bg-muted/40 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-primary font-serif">
                          {article.articleNumber}
                        </span>
                        {article.title && (
                          <span className="text-xs font-semibold text-foreground">
                            - {article.title}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-muted-foreground font-medium">
                        {article.legalText.shortTitle || article.legalText.title} ({article.legalText.jurisdiction})
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCopyCitation(article, article.legalText.shortTitle || article.legalText.title)}
                        className="text-[11px] h-7 px-2"
                      >
                        {copiedId === article.articleNumber ? (
                          <Check className="w-3 h-3 text-emerald-600 mr-1" />
                        ) : (
                          <Copy className="w-3 h-3 mr-1" />
                        )}
                        {locale === "fr" ? "Citer" : "Cite"}
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setAttachArticle({
                            textTitle: article.legalText.shortTitle || article.legalText.title,
                            articleNumber: article.articleNumber,
                            content: article.content,
                          })
                        }
                        className="text-[11px] h-7 px-2"
                      >
                        <FolderPlus className="w-3 h-3 mr-1" />
                        {locale === "fr" ? "Dossier" : "Matter"}
                      </Button>
                    </div>
                  </div>

                  <p className="text-xs font-serif text-foreground/90 leading-relaxed bg-white p-3 rounded border border-border/60 dark:bg-card">
                    {article.content}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* DUAL-PANEL BROWSER VIEW */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left Column: Legal Texts Selector */}
          <div className="lg:col-span-4 space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">
              {locale === "fr" ? "Textes & Codes disponibles" : "Available Statutes & Codes"}
            </h2>

            <div className="space-y-2">
              {filteredTexts.map((txt) => {
                const isSelected = txt.id === selectedTextId;

                return (
                  <button
                    key={txt.id}
                    onClick={() => setSelectedTextId(txt.id)}
                    className={`w-full text-left p-3.5 rounded-xl border transition-all space-y-1.5 ${
                      isSelected
                        ? "bg-white border-primary shadow-sm ring-1 ring-primary/20 dark:bg-card"
                        : "bg-white/80 border-border hover:bg-white hover:border-primary/40 dark:bg-card/70"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <Badge
                        variant="outline"
                        className="text-[10px] font-mono bg-slate-50 text-slate-800"
                      >
                        {txt.shortTitle || txt.code}
                      </Badge>
                      <Badge className="bg-emerald-50 text-emerald-800 border-emerald-200 text-[9px]">
                        En vigueur
                      </Badge>
                    </div>

                    <h3 className="text-xs font-semibold text-foreground line-clamp-2">
                      {txt.title}
                    </h3>

                    <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
                      <span>{txt.jurisdiction}</span>
                      <span>{txt._count?.articles || 0} articles indexés</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Column: Text Reader & Articles */}
          <div className="lg:col-span-8 bg-white rounded-xl border border-border p-6 shadow-sm dark:bg-card space-y-6">
            {loadingText ? (
              <div className="py-20 text-center text-xs text-muted-foreground">
                {locale === "fr" ? "Chargement des articles..." : "Loading articles..."}
              </div>
            ) : currentText ? (
              <>
                {/* Header of selected text */}
                <div className="border-b border-border pb-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="text-xs font-mono font-bold bg-primary/5 text-primary">
                      {currentText.code}
                    </Badge>
                    {currentText.sourceUrl && (
                      <a
                        href={currentText.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-primary underline flex items-center gap-1 font-medium"
                      >
                        <span>Source institutionnelle</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>

                  <h2 className="text-base font-bold text-primary font-serif">
                    {currentText.title}
                  </h2>

                  {currentText.gazetteRef && (
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium">Publication :</span> {currentText.gazetteRef}
                    </p>
                  )}

                  {currentText.description && (
                    <p className="text-xs text-muted-foreground bg-muted/40 p-3 rounded-lg leading-relaxed">
                      {currentText.description}
                    </p>
                  )}
                </div>

                {/* Articles List */}
                <div className="space-y-6">
                  {currentText.articles?.map((article: LegalArticle) => (
                    <div
                      key={article.id}
                      className="border border-border/80 rounded-xl p-5 bg-card/40 space-y-3 hover:border-primary/40 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <span className="text-sm font-bold text-primary font-serif">
                            {article.articleNumber}
                          </span>
                          {article.title && (
                            <h4 className="text-xs font-semibold text-foreground mt-0.5">
                              {article.title}
                            </h4>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleCopyCitation(article)}
                            className="text-xs h-7 px-2.5"
                          >
                            {copiedId === article.articleNumber ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600 mr-1" />
                            ) : (
                              <Copy className="w-3.5 h-3.5 mr-1" />
                            )}
                            {locale === "fr" ? "Copier citation" : "Copy citation"}
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setAttachArticle({
                                textTitle: currentText.shortTitle || currentText.title,
                                articleNumber: article.articleNumber,
                                content: article.content,
                              })
                            }
                            className="text-xs h-7 px-2.5 text-primary border-primary/20 hover:bg-primary/5"
                          >
                            <FolderPlus className="w-3.5 h-3.5 mr-1" />
                            {locale === "fr" ? "Lier au dossier" : "Link to matter"}
                          </Button>
                        </div>
                      </div>

                      <div className="text-xs font-serif text-foreground/90 leading-relaxed bg-white dark:bg-card p-4 rounded-lg border border-border/60 whitespace-pre-wrap">
                        {article.content}
                      </div>

                      {article.keywords && article.keywords.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap pt-1">
                          {article.keywords.map((kw, i) => (
                            <Badge
                              key={i}
                              variant="outline"
                              className="text-[10px] text-muted-foreground bg-muted/40 font-normal"
                            >
                              #{kw}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="py-20 text-center text-xs text-muted-foreground">
                {locale === "fr" ? "Sélectionnez un texte dans la liste." : "Select a text from the list."}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Attach Article to Matter Modal */}
      {attachArticle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-2xl space-y-4 dark:bg-card border border-border">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-sm font-bold text-primary">
                  {locale === "fr" ? "Lier cet article à un dossier" : "Link Legal Authority to Matter"}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {attachArticle.textTitle} - {attachArticle.articleNumber}
                </p>
              </div>
              <button
                onClick={() => setAttachArticle(null)}
                className="text-muted-foreground hover:text-foreground text-sm"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAttachSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-primary block mb-1">
                  {locale === "fr" ? "Sélectionner le dossier client *" : "Select Target Matter *"}
                </label>
                <select
                  value={selectedMatterId}
                  onChange={(e) => setSelectedMatterId(e.target.value)}
                  className="w-full text-xs rounded-md border border-input bg-background p-2.5"
                  required
                >
                  {matters.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.reference || m.code} - {m.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="bg-muted/40 p-3 rounded-lg border border-border text-xs font-serif text-muted-foreground max-h-36 overflow-y-auto">
                <span className="font-bold text-primary block font-sans mb-1">Aperçu de la citation :</span>
                {attachArticle.content}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setAttachArticle(null)}
                  className="text-xs"
                >
                  {locale === "fr" ? "Annuler" : "Cancel"}
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isAttaching || !selectedMatterId}
                  className="text-xs"
                >
                  <FolderPlus className="w-3.5 h-3.5 mr-1.5" />
                  {isAttaching
                    ? locale === "fr"
                      ? "Enregistrement..."
                      : "Attaching..."
                    : locale === "fr"
                    ? "Attacher comme note de recherche"
                    : "Attach as research note"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
