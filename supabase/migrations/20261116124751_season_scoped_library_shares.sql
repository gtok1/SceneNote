-- NULL preserves existing content_ids links; new shares retain registration identity and order.
ALTER TABLE public.library_shares
  ADD COLUMN library_item_ids uuid[];

COMMENT ON COLUMN public.library_shares.library_item_ids IS
  'Ordered selected user_library_items ids. NULL identifies legacy content_ids shares.';

ALTER TABLE public.library_shares
  ADD CONSTRAINT library_shares_registration_limit CHECK (
    library_item_ids IS NULL OR cardinality(library_item_ids) BETWEEN 1 AND 1000
  );

-- Direct authenticated fallback must validate the same ownership boundary as the Edge handler.
DROP POLICY IF EXISTS library_shares_insert_own ON public.library_shares;
CREATE POLICY library_shares_insert_own ON public.library_shares
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = owner_user_id
    AND (
      library_item_ids IS NULL
      OR NOT EXISTS (
        SELECT 1 FROM unnest(library_item_ids) AS selected(library_item_id)
        WHERE NOT EXISTS (
          SELECT 1 FROM public.user_library_items AS item
          WHERE item.id = selected.library_item_id AND item.user_id = auth.uid()
        )
      )
    )
  );

DROP POLICY IF EXISTS library_shares_update_own ON public.library_shares;
CREATE POLICY library_shares_update_own ON public.library_shares
  FOR UPDATE TO authenticated
  USING (auth.uid() = owner_user_id)
  WITH CHECK (
    auth.uid() = owner_user_id
    AND (
      library_item_ids IS NULL
      OR NOT EXISTS (
        SELECT 1 FROM unnest(library_item_ids) AS selected(library_item_id)
        WHERE NOT EXISTS (
          SELECT 1 FROM public.user_library_items AS item
          WHERE item.id = selected.library_item_id AND item.user_id = auth.uid()
        )
      )
    )
  );
